import { firstUppercase } from "./strings";

const OBSIDIAN_ILLEGAL_FILENAME_CHARS = /[/\\:*?"<>|#^[\]]/g;

/** Creates an Obsidian filename from a string. */
export function generateObsidianFilename(name: string): string {
  return firstUppercase(
    name
      .replaceAll(OBSIDIAN_ILLEGAL_FILENAME_CHARS, " ")
      .replaceAll(/\s+/g, " ")
      .trim(),
  );
}
