import idMapRaw from "../../data/datasworn-0.0.10-to-0.1.0-id_map.json" assert { type: "json" };

const LINK_REGEX =
  /\[(?<label>\w[^\]]+)\]\((?<kind>id|move|asset|oracle):(?<id>[-\w._]+(?:(?:\/|\\\/)[-\w._]+)*)\)/g;

const idMap: Record<string, string | null> = idMapRaw;

export function replaceLinks(input: string): string {
  return input.replaceAll(
    LINK_REGEX,
    (orig, label: string, kind: string, id: string) => {
      // If the string has escaped forward slashes, assume it is a KDL string, and it needs escaping
      const isKdl = id.indexOf("\\/") > -1;
      if (isKdl) {
        id = id.replaceAll("\\/", "/");
      }
      const newId = idMap[id];
      return newId
        ? `[${label}](${isKdl ? newId.replaceAll("/", "\\/") : newId})`
        : orig;
    },
  );
}
