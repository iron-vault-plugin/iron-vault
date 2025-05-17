import { Either, Left, Right } from "utils/either";
import * as yaml from "yaml";

export function extractFrontmatter(
  content: string,
): Either<Error, Record<string, unknown> | undefined> {
  if (!content.startsWith("---\n")) {
    return Right.create(undefined);
  }
  const endPos = content.indexOf("---\n", 4);
  if (endPos == -1) {
    return Left.create(new Error("no terminator found."));
  }
  const frontmatter = content.slice(4, endPos);

  try {
    return Right.create(yaml.parse(frontmatter) ?? {});
  } catch (error) {
    return Left.create(
      error instanceof Error ? error : new Error("Invalid frontmatter"),
    );
  }
}
