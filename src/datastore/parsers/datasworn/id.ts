import { TypeId } from "@datasworn/core/dist/IdElements";

// TODO(@cwegrzyn): is there an official low complexity regex for datasworn ids?
const DATASWORN_LINK_REGEX = new RegExp(
  String.raw`^((?:${TypeId.Primary.join("|")})(?:\.[-\w]+)*):(\w[-\w /\.]+)$`,
);

export function extractDataswornLinkParts(
  uri: string,
): [string, string] | null {
  const result = uri.match(DATASWORN_LINK_REGEX);
  return result && [result[1], result[2]];
}
