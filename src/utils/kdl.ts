import { Node } from "kdljs";

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
