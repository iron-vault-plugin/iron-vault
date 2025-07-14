import yaml from "js-yaml";
import { Result } from "true-myth/result";
import {
  ActionMoveDescriptionV1,
  ActionMoveDescriptionV2,
  AllMoveDescriptionSchemas,
  AllMoveDescriptions,
  MoveDescription,
} from "./desc";

export class MoveParseError extends Error {}

export function parseMoveBlock(
  moveBlock: string,
): Result<MoveDescription, MoveParseError> {
  const lines = moveBlock.split(/\r?\n/g);
  const emptyLine = lines.findIndex((line) => line.length == 0);
  const dataLines = emptyLine == -1 ? lines : lines.slice(0, emptyLine);
  if (dataLines.length == 0) {
    return Result.err(
      new MoveParseError(
        "move block should start with move line or YAML; found empty line",
      ),
    );
  } else {
    return parseMoveYaml(dataLines.join("\n"));
  }
}

export function convertV1toV2(
  original: ActionMoveDescriptionV1,
): ActionMoveDescriptionV2 {
  return { ...original, adds: [{ amount: original.adds }] };
}

export function isV1ActionSchema(
  original: AllMoveDescriptions,
): original is ActionMoveDescriptionV1 {
  return "adds" in original && typeof original.adds == "number";
}

export function parseMoveYaml(
  input: string,
): Result<MoveDescription, MoveParseError> {
  let data;
  try {
    data = yaml.load(input);
  } catch (e) {
    return Result.err(new MoveParseError("error parsing YAML", { cause: e }));
  }
  const initParseResult = AllMoveDescriptionSchemas.safeParse(data);

  if (initParseResult.success) {
    const data = initParseResult.data;

    if (isV1ActionSchema(data)) {
      return Result.ok(convertV1toV2(data));
    }

    return Result.ok(data);
  } else {
    return Result.err(
      new MoveParseError("invalid move YAML", { cause: initParseResult.error }),
    );
  }
}
