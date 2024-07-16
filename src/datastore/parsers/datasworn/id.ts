import { TypeId } from "@datasworn/core/dist/IdElements";

// TODO(@cwegrzyn): is there an official low complexity regex for datasworn ids?
const DATASWORN_ID_REGEX_NO_ANCHOR = new RegExp(
  String.raw`((?:${TypeId.Primary.join("|")})(?:\.[-\w]+)*):(\w[-\w /\.]+)`,
);

const DATASWORN_ID_REGEX = new RegExp(
  String.raw`^(?:datasworn:)?${DATASWORN_ID_REGEX_NO_ANCHOR.source}$`,
);

const DATASWORN_LINK_REGEX = new RegExp(
  String.raw`\[(?<label>[^\]]*)\]\((?:datasworn:)?(?<id>${DATASWORN_ID_REGEX_NO_ANCHOR.source})\)`,
);

export type ParsedDataswornId = {
  id: string;
  kind: string;
  path: string;
};

/** Given a datasworn URI (e.g., in an href), extracts the kind and the path.
 * Works with both old-style invalid URIs (w/o `datasworn:` prefix) and newer `datasworn:` prefixed ones
 */
export function extractDataswornLinkParts(
  uri: string,
): ParsedDataswornId | null {
  const result = uri.match(DATASWORN_ID_REGEX);
  return (
    result && {
      id: `${result[1]}:${result[2]}`,
      kind: result[1],
      path: result[2],
    }
  );
}

/** Finds a markdown datasworn link and returns the text and URI.
 * Works with both old-style invalid URIs (w/o `datasworn:` prefix) and newer `datasworn:` prefixed ones.
 */
export function matchDataswornLink(
  text: string,
): { label: string; id: string } | null {
  const match = text.match(DATASWORN_LINK_REGEX);
  if (!match) return null;
  return { label: match.groups!.label, id: match.groups!.id };
}

/** Render a markdown link for a given datasworn ID. */
export function createDataswornMarkdownLink(label: string, id: string): string {
  if (id.startsWith("datasworn:"))
    throw new Error(
      `Unexpected 'datasworn:' prefix when generating link for '${id}'`,
    );
  return `[${label}](datasworn:${id})`;
}
