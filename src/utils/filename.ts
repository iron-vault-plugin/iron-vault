import { capitalize } from "./strings";

const OBSIDIAN_ILLEGAL_FILENAME_CHARS = /[/\\:*?"<>|#^[\]]/g;

/** Creates an Obsidian filename from a string. */
export function generateObsidianFilename(name: string): string {
  return capitalize(
    name
      .replaceAll(OBSIDIAN_ILLEGAL_FILENAME_CHARS, " ")
      .replaceAll(/\s+/g, " ")
      .trim(),
  );
}

export function isValidObsidianFilename(
  name: string,
  allowEmpty: boolean = false,
): boolean {
  return (
    name.length > (allowEmpty ? 0 : 1) &&
    !OBSIDIAN_ILLEGAL_FILENAME_CHARS.test(name)
  );
}

export function isValidObsidianPath(name: string): boolean {
  return name
    .split("/")
    .every(
      (part) => part.length > 0 && !OBSIDIAN_ILLEGAL_FILENAME_CHARS.test(name),
    );
}
