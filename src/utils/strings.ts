/** Capitalize the first character of a string. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Capitalize the first letter of every word. */
export function titleCase(str: string): string {
  return str
    .split(" ")
    .map(([h, ...t]) => h.toUpperCase() + t.join("").toLowerCase())
    .join(" ");
}

export function makeSafeForId(str: string): string {
  return str
    .replaceAll(/[^\w]+/g, "_")
    .replaceAll(/_{2,}/g, "_")
    .replaceAll(/^_|_$/g, "")
    .toLowerCase();
}
