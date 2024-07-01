import { TypeId } from "@datasworn/core/dist/IdElements";

// TODO(@cwegrzyn): is there an official low complexity regex for datasworn ids?
export const DATASWORN_ID_REGEX = new RegExp(
  String.raw`^((?:${TypeId.Primary.join("|")})(?:\.[-\w]+)*):(\w[-\w /\.]+)$`,
);

export const DATASWORN_ID_REGEX_NO_ANCHOR = new RegExp(
  String.raw`((?:${TypeId.Primary.join("|")})(?:\.[-\w]+)*):(\w[-\w /\.]+)`,
);

export const DATASWORN_LINK_REGEX = new RegExp(
  String.raw`\[(?<label>[^\]]*)\]\((?<uri>${DATASWORN_ID_REGEX_NO_ANCHOR.source})\)`,
);

export function extractDataswornLinkParts(
  uri: string,
): [string, string] | null {
  const result = uri.match(DATASWORN_ID_REGEX);
  return result && [result[1], result[2]];
}
