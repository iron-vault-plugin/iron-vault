// I can't actually import this from the original package once enabling ESM for jest
// so I have this weird hack which ensures the type is correct.
import { default as OrigTypeId } from "@datasworn/core/dist/IdElements/TypeId.js";

const TypeId: { Primary: typeof OrigTypeId.Primary } = {
  Primary: [
    "atlas_entry",
    "npc",
    "oracle_rollable",
    "asset",
    "move",
    "atlas_collection",
    "npc_collection",
    "oracle_collection",
    "asset_collection",
    "move_category",
    "delve_site",
    "delve_site_domain",
    "delve_site_theme",
    "rarity",
    "truth",
  ] satisfies typeof OrigTypeId.Primary,
};

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

export function parseDataswornLinks(
  text: string,
): (string | { match: string; label: string; id: string })[] {
  const results: (string | { match: string; label: string; id: string })[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(new RegExp(DATASWORN_LINK_REGEX, "g"))) {
    if (match.index > lastIndex) {
      results.push(text.slice(lastIndex, match.index));
    }
    const { label, id } = match.groups!;
    results.push({ match: match[0], label, id });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    results.push(text.slice(lastIndex));
  }
  return results;
}

/** Render a markdown link for a given datasworn ID. */
export function createDataswornMarkdownLink(label: string, id: string): string {
  if (id.startsWith("datasworn:"))
    throw new Error(
      `Unexpected 'datasworn:' prefix when generating link for '${id}'`,
    );
  return `[${label}](datasworn:${id})`;
}
