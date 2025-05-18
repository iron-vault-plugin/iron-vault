import { DataswornSource } from "@datasworn/core";
import {
  apply,
  consumed,
  liftAsList,
  makeError,
  Parser,
  ParserError,
  pipe,
  recognize,
  repeat,
  runParser,
  runParserPartial,
  seq,
  some,
} from "@ironvault/parsing";
import { alt, cut, optional } from "@ironvault/parsing/branching";
import {
  children,
  mdastType,
  onlyText,
  sentence,
  Sentence,
  sentenceToString,
  skipFrontmatter,
} from "@ironvault/parsing/markdown";
import * as mdast from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import { Either, flatMap, Left, Right } from "utils/either";

/**
 * Parses a markdown asset into a Datasworn asset object.
 *
 * Format is:
 * ---
 * optional-front-matter: ...
 * ---
 *
 * # Move name (category)
 *
 * **When you make a move to xyz,** abc.
 *
 * - blah blah, roll +wits
 *
 * On a strong hit,
 *
 * On a weak hit,
 *
 * On a miss,
 *
 */
export function markdownMoveToDatasworn(
  content: string,
): Either<ParserError, Omit<DataswornSource.Move, "_source">> {
  const tree = fromMarkdown(content, {
    extensions: [gfm(), frontmatter(["yaml"])],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(["yaml"])],
  });

  const parser = children(
    seq(skipFrontmatter, optional(parseNameHeading), extractBlocks),
  );

  const result = runParser(parser, tree);

  return flatMap(result, ([_frontmatter, name, blocks]) => {
    if (name === undefined) {
      return Left.create(new ParserError("Move must have a name"));
    }

    // Convert blocks to sentences
    const result = runParserPartial(
      pipe(
        apply(repeat(0, undefined, extractParagraphs), (_) => _.flat()),
        apply(liftAsList(repeat(0, undefined, extractSentences)), (s) =>
          s.flat(),
        ),
        liftAsList(parseMoveSentences),
      ),
      ...blocks,
    );
    if (result.isLeft()) {
      return result;
    }

    const [[trigger, sentences]] = result.value;
    const conditions: DataswornSource.TriggerActionRollCondition[] = [];
    let i = 0;

    while (sentences[i] && sentences[i].tag !== "outcome") {
      const sentence = sentences[i];
      if (sentence.tag === "roll") {
        conditions.push({
          method: "player_choice",
          roll_options: [
            {
              // TODO: this is not necessarily a stat, but it's tricky to determine
              using: "stat",
              stat: sentence.using,
            },
          ],
        });
      } else if (sentences[i].tag === "other") {
        // Do nothing, just text
      }
      i++;
    }

    const outcomes: DataswornSource.MoveOutcomes = {
      strong_hit: { text: "" },
      weak_hit: { text: "" },
      miss: { text: "" },
    };

    while (sentences[i]) {
      const sentence = sentences[i];
      if (sentence.tag === "outcome") {
        const outcome = sentence.outcome;
        const parts = [...sentence.text];
        // Take all untagged sentences until the next tagged sentence
        while (sentences[++i] && sentences[i].tag === "other") {
          parts.push(...sentences[i].text);
        }
        outcomes[outcome] = {
          text: renderMarkdown({
            type: "root",
            children: parts.flatMap((s) => s.parts),
          }),
        };
      } else if (sentence.tag === "roll") {
        // This should not happen, as we expect all rolls to be before outcomes
        return Left.create(
          new ParserError("Unexpected roll after outcomes in move"),
        );
      }
    }

    const text = content
      .slice(
        blocks[0]!.position!.start.offset!,
        blocks[blocks.length - 1]!.position!.end.offset! + 1,
      )
      .trim();

    const move: Omit<DataswornSource.MoveActionRoll, "_source"> = {
      type: "move",
      roll_type: "action_roll",
      name,
      text,
      trigger: {
        text: trigger + "...",
        conditions,
      },
      outcomes,
    };

    return Right.create(move);
  });
}

const parseNameHeading = pipe(
  mdastType("heading", (node) => node.depth === 1),
  cut(onlyText),
);

const extractBlocks: Parser<
  (mdast.Paragraph | mdast.List)[],
  mdast.RootContent
> = repeat(1, undefined, alt(mdastType("paragraph"), mdastType("list")));

const extractParagraphs: Parser<mdast.Paragraph[], mdast.RootContent> = alt(
  apply(mdastType("paragraph"), (p) => [p]),
  pipe(
    mdastType("list"),
    apply(
      children(
        repeat(
          1,
          undefined,
          pipe(
            mdastType("listItem"),
            children<
              mdast.Paragraph[],
              mdast.BlockContent | mdast.DefinitionContent,
              mdast.ListItem
            >(
              repeat(
                1,
                undefined,
                mdastType<
                  "paragraph",
                  keyof mdast.BlockContentMap | keyof mdast.DefinitionContentMap
                >("paragraph"),
              ),
            ),
          ),
        ),
      ),
      (items) => items.flat(),
    ),
  ),
);

const extractSentences: Parser<Sentence[], mdast.Paragraph> = children(
  repeat(1, undefined, sentence),
);

/** Parser that matches a sentence against a regexp. Note that by default, whitespace is trimmed. */
export function sentenceRegex(
  re: RegExp,
  trimWhitespace: boolean = true,
): Parser<RegExpMatchArray, Sentence> {
  return pipe(some(), (node) => {
    const value = sentenceToString(node.value);
    const result = (trimWhitespace ? value.trim() : value).match(re);
    if (result === null) {
      return makeError(node, `Expected sentence to match regex "${re}"`);
    }
    return Right.create({
      value: result,
      start: node,
      next: node.next,
    });
  });
}

function renderMarkdown(content: mdast.Nodes): string {
  return toMarkdown(content, {
    extensions: [gfmToMarkdown()],
    // These match the conventions used in Datasworn
    emphasis: "*",
    strong: "_",
  }).trim();
}

type SentenceKind =
  | {
      tag: "outcome";
      outcome: "strong_hit" | "weak_hit" | "miss";
      text: Sentence[];
    }
  | {
      tag: "roll";
      text: Sentence[];
      using: string;
    }
  | {
      tag: "other";
      text: Sentence[];
    };

const parseMoveSentences: Parser<
  [trigger: string, sentences: SentenceKind[]],
  Sentence
> = seq(
  apply(sentenceRegex(/^(When[^,]+),/i), ([, trigger]) => trigger),
  repeat(
    1,
    undefined,
    alt(
      apply(recognize(sentenceRegex(/^(On a strong hit,)(.*)/i)), (s) => ({
        tag: "outcome",
        outcome: "strong_hit",
        text: s,
      })),
      apply(recognize(sentenceRegex(/^(On a weak hit,)(.*)/i)), (s) => ({
        tag: "outcome",
        outcome: "weak_hit",
        text: s,
      })),
      apply(recognize(sentenceRegex(/^(On a miss,)(.*)/i)), (s) => ({
        tag: "outcome",
        outcome: "miss",
        text: s,
      })),

      apply(consumed(sentenceRegex(/roll \+([\w\s]+)/)), ([s, [, using]]) => ({
        tag: "roll",
        text: s,
        using: using.trim(),
      })),
      apply(some(), (s) => ({ tag: "other", text: [s] })),
    ),
  ),
);
