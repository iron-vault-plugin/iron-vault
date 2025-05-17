import * as mdast from "mdast";
import { FrontmatterContent, RootContent, RootContentMap, Yaml } from "mdast";
import { Left, Right } from "utils/either";
import { apply, consumeAll, liftAsList, matchOpt, pipe, some } from ".";
import {
  LazyPNode,
  PNode,
  Parser,
  ParserError,
  ParserErrors,
  RecoverableParserError,
  makeError,
} from "./parser";

/** Parse a node of a specific mdast type, yielding that node. */
export function mdastType<
  const C extends N,
  N extends keyof RootContentMap = keyof RootContentMap,
  E extends ParserErrors = ParserErrors,
>(
  type: C,
  check?: (node: RootContentMap[NoInfer<C>]) => boolean,
): Parser<RootContentMap[C], RootContentMap[N], E | RecoverableParserError> {
  return (node) => {
    if (node === undefined) {
      return makeError(
        node,
        `expected node of type ${type}, found end-of-sequence`,
      );
    }
    const value = node.value;
    if (value.type === type) {
      if (check && !check(value as RootContentMap[C])) {
        return makeError(node, `node of type ${type} did not pass check`);
      }

      return Right.create({
        value: value as RootContentMap[C],
        start: node,
        next: node.next,
      });
    } else {
      return makeError(
        node,
        `expected node of type ${type}, found ${node.value.type}`,
      );
    }
  };
}

export function children<
  V,
  C,
  N extends { children: C[] },
  E extends ParserError = ParserError,
>(parser: Parser<V, C, E>): Parser<V, N, E | ParserError> {
  return pipe(
    apply(some(), (node) => node.children),
    liftAsList(parser),
  );
}
export const skipFrontmatter = matchOpt(
  (node: RootContent): node is FrontmatterContent => node.type === "yaml",
  (node: Yaml) => Right.create(node.value),
); /** Parse a node that has only a single text child. */
export const onlyText: Parser<string, mdast.Parents> = (node) => {
  if (node === undefined) {
    return makeError(node, "Expected a node, found end-of-sequence");
  }

  const children = node.value.children;

  if (children.length !== 1) {
    return makeError(
      node,
      `Expected a single child, found ${node.value.children.length}`,
    );
  }

  if (children[0].type !== "text") {
    return makeError(
      node,
      `Expected a text node as child,  found ${children[0].type}`,
    );
  }

  return Right.create({
    value: children[0].value,
    start: node,
    next: node.next,
  });
};

export type Sentence = {
  parts: mdast.PhrasingContent[];
};

export function partIsTerminated(part: mdast.PhrasingContent): boolean {
  switch (part.type) {
    case "inlineCode":
    case "text":
      return part.value.endsWith(".");
    case "break":
      return true; // A break always ends the sentence.
    case "delete":
    case "emphasis":
    case "strong":
      return partIsTerminated(part.children[part.children.length - 1]);
    case "footnoteReference":
    case "html":
    case "image":
    case "imageReference":
    case "link":
    case "linkReference":
      return false;
  }
}

export function sentenceIsTerminated(sentence: Sentence): boolean {
  if (sentence.parts.length === 0) {
    return false; // An empty sentence is never terminated.
  }
  const lastPart = sentence.parts[sentence.parts.length - 1];
  return partIsTerminated(lastPart);
}

export function sentenceToString(sentence: Sentence): string {
  return sentence.parts
    .map((part) => {
      switch (part.type) {
        case "inlineCode":
        case "text":
          return part.value;
        case "break":
          return "\n"; // A break is represented as a newline.
        case "delete":
        case "emphasis":
        case "strong":
          return sentenceToString({
            parts: part.children,
          });
        case "footnoteReference":
        case "html":
        case "image":
        case "imageReference":
        case "link":
        case "linkReference":
          return ""; // These nodes do not contribute to the sentence string.
      }
    })
    .join("");
}

/** Splits markdown content on sentence breaks. Preserves the structure across splits. */
export const sentence: Parser<Sentence, mdast.PhrasingContent> = (start) => {
  if (start === undefined) {
    return Left.create(new ParserError("Expected phrasing content, found end"));
  }
  const parts: Sentence["parts"] = [];
  let node: typeof start | undefined = start;
  while (node) {
    switch (node?.value.type) {
      case "inlineCode":
      case "text": {
        const eosPos = node.value.value.indexOf(".");
        const [left, right] =
          eosPos === -1
            ? [node.value.value]
            : [
                node.value.value.slice(0, eosPos),
                node.value.value.slice(eosPos + 1),
              ];

        if (right === undefined) {
          // We had no period, so this whole block goes on the sentence and we aren't done yet.
          parts.push(node.value);
        } else {
          // We had a period, so we take the left part and return it as a sentence.
          parts.push({ ...node.value, value: left + "." });

          return Right.create({
            value: { parts },
            start: node,
            next:
              right.length > 0
                ? { value: { ...node.value, value: right }, next: node.next }
                : node.next,
          });
        }

        break;
      }
      case "break":
        // An explicit break means we end the sentence here.
        parts.push(node.value);
        return Right.create({
          value: { parts },
          start: node,
          next: node.next,
        });

      case "delete":
      case "emphasis":
      case "strong": {
        const subResult = sentence(LazyPNode.forSeq(...node.value.children));
        if (subResult.isLeft()) {
          return subResult;
        }
        const { value: subValue, next: subNext } = subResult.value;
        // We found a sentence break in the children, so we wrap the parts back into the parent node
        // and return the sentence, creating a new part with the remaining children.
        if (sentenceIsTerminated(subValue)) {
          parts.push({
            ...node.value,
            children: subValue.parts,
          });
          const next: PNode<mdast.PhrasingContent> | undefined = subNext
            ? {
                value: {
                  ...node.value,
                  children: consumeAll(subNext).unwrap().value,
                },
                next: node.next,
              }
            : node.next;
          return Right.create({
            value: { parts },
            start: node,
            next,
          });
        }

        // If the sub-sentence is incomplete, we just add the whole node to the current
        // sentence.
        parts.push(node.value);
        break;
      }

      case "footnoteReference":
      case "html": // TODO: maybe HTML should be handled differently?
      case "image": // TODO: maybe images should end the sentence?
      case "imageReference":
      case "link":
      case "linkReference":
        // These nodes are just added as-is, because they don't contain sentence content. They do
        // not end the sentence.
        parts.push(node.value);
        break;
    }

    node = node.next;
  }

  // No more nodes, so we return the sentence with whatever parts we have or an error
  // if we have none.
  if (parts.length === 0) {
    return makeError(node, "Expected phrasing content, found end");
  }
  return Right.create({
    value: { parts },
    start,
    next: undefined,
  });
};
