import * as kdl from "kdljs";
import { z } from "zod";

export type { FormattingOptions, Value } from "kdljs";

// The types in kdljs don't actually match the spec or the types that kdljs
// itself accepts/produces. Consequently, we need to redefine them here.

export type Document = Node[];

export interface NodeTypeAnnotations {
  name?: string | undefined;
  properties: Record<string, string | undefined>;
  values: (string | undefined)[];
}

export interface Node {
  /** The name of the Node */
  name: string;
  /** Collection of {@link https://github.com/kdl-org/kdl/blob/main/SPEC.md#argument|Arguments} */
  values: kdl.Value[];
  /** Collection of {@link https://github.com/kdl-org/kdl/blob/main/SPEC.md#property|Properties} */
  properties: Record<string, kdl.Value>;
  /** Nodes in the {@link https://github.com/kdl-org/kdl/blob/main/SPEC.md#children-block|Children block} */
  children: Node[];
  /** Collection of {@link https://github.com/kdl-org/kdl/blob/main/SPEC.md#type-annotation|type annotations} */
  tags: NodeTypeAnnotations;
}

export interface ParseResult {
  /** Parsing errors */
  errors: chevrotain.IRecognitionException[];
  /** KDL Document */
  output?: Document;
}

export type KdlNode<
  N extends string,
  V extends kdl.Value[],
  P extends Record<string, kdl.Value>,
  C extends Node[],
> = {
  name: N;
  values: V;
  properties: P;
  children: C;
  tags: NodeTypeAnnotations;
};

export function builder<
  const N extends string,
  V extends z.ZodType<kdl.Value[], z.ZodTypeDef, unknown>,
  P extends z.ZodType<Record<string, kdl.Value>, z.ZodTypeDef, unknown>,
  C extends z.ZodType<Node[], z.ZodTypeDef, unknown>,
>(name: N, values: V, properties: P, children: C) {
  const schema = z.object({
    name: z.literal(name).default(name),
    values: values,
    properties: properties,
    children: children,
    tags: z
      .object({
        name: z.string().optional(),
        properties: z.record(z.string().optional()).default({}),
        values: z.array(z.string().optional()).default([]),
      })
      .default({ name: undefined, properties: {}, values: [] }),
  });
  return [
    schema,
    (data: z.input<typeof schema>) => schema.parse(data),
  ] as const;
}

export const noValues = z.tuple([]).default([]);
export const noProperties = z.record(z.string()).default({});
export const noChildren = z.tuple([]).default([]);

export function node(
  name: string,
  data: Omit<Partial<Node>, "name"> = {},
): Node {
  return {
    name,
    properties: {},
    values: [],
    children: [],
    ...data,
    // TODO: the `as any` is a hack because the name field is not optional currently but should be
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: { properties: {}, values: [], ...data.tags } as any,
  };
}

/**
 * @param {string} text - Input KDL file (or fragment)
 */
export function parse(text: string): ParseResult {
  return kdl.parse(text);
}

/**
 * @param {Document} doc - Input KDL document
 */
export function format(doc: Document, options?: kdl.FormattingOptions): string {
  return kdl.format(doc as kdl.Document, options);
}
