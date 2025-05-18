import Result from "true-myth/result";
import * as yaml from "yaml";

export function extractFrontmatter(
  content: string,
): Result<Record<string, unknown> | undefined, Error> {
  if (!content.startsWith("---\n")) {
    return Result.ok(undefined);
  }
  const endPos = content.indexOf("---\n", 4);
  if (endPos == -1) {
    return Result.err(new Error("no terminator found."));
  }
  const frontmatter = content.slice(4, endPos);

  try {
    return Result.ok(yaml.parse(frontmatter) ?? {});
  } catch (error) {
    return Result.err(
      error instanceof Error ? error : new Error("Invalid frontmatter"),
    );
  }
}
