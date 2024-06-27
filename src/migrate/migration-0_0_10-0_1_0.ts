import idMapRaw from "../../data/datasworn-0.0.10-to-0.1.0-id_map.json" assert { type: "json" };

const ID_REGEX = /(?<id>[-\w._]+(?:(?:\/|\\\/)[-\w._]+)*)/g;
const KIND_REGEX = /(?<kind>id|move|asset|oracle):/g;
const ID_OPTIONAL_KIND_REGEX = new RegExp(
  String.raw`(?:${KIND_REGEX.source})?${ID_REGEX.source}`,
  "g",
);
const LINK_REGEX = new RegExp(
  String.raw`\[(?<label>\w[^\]]+)\]\(${KIND_REGEX.source}${ID_REGEX.source}\)`,
  "g",
);

const idMap: Record<string, string | null> = idMapRaw;

function getNewId(id: string): string | null {
  // If the string has escaped forward slashes, assume it is a KDL string, and it needs escaping
  const isKdl = id.indexOf("\\/") > -1;
  if (isKdl) {
    id = id.replaceAll("\\/", "/");
  }
  const newId = idMap[id];
  return newId && (isKdl ? newId.replaceAll("/", "\\/") : newId);
}

export function hasOldId(input: string): boolean {
  for (const [id] of input.matchAll(ID_REGEX)) {
    if (getNewId(id)) {
      return true;
    }
  }
  return false;
}

export function replaceIds(
  input: string,
  log?: { offset: number; length: number; newId: string }[],
): string {
  return input.replaceAll(
    ID_OPTIONAL_KIND_REGEX,
    (orig, kind: string, id: string, offset: number) => {
      const newId = getNewId(id);
      if (log && newId) {
        log.push({ offset, length: orig.length, newId });
      }
      return newId ?? orig;
    },
  );
}

export function replaceLinks(input: string): string {
  return input.replaceAll(
    LINK_REGEX,
    (orig, label: string, kind: string, id: string) => {
      const newId = getNewId(id);
      return newId ? `[${label}](${newId})` : orig;
    },
  );
}
