import yaml from "js-yaml";
import { Either, Left, Right } from "../utils/either";
import {
  ActionMoveDescriptionV1,
  ActionMoveDescriptionV2,
  AllMoveDescriptionSchemas,
  AllMoveDescriptions,
  MoveDescription,
} from "./desc";
import { parseMoveLine } from "./move-line-parser";

export class MoveParseError extends Error {}

export function parseMoveBlock(
  moveBlock: string,
): Either<MoveParseError, MoveDescription> {
  const lines = moveBlock.split(/\r?\n/g);
  const emptyLine = lines.findIndex((line) => line.length == 0);
  const dataLines = emptyLine == -1 ? lines : lines.slice(0, emptyLine);
  if (dataLines.length == 0) {
    return Left.create(
      new MoveParseError(
        "move block should start with move line or YAML; found empty line",
      ),
    );
  } else if (dataLines.length == 1) {
    return parseMoveLine(dataLines[0]).mapError(
      (msg) => new MoveParseError(`Error parsing move line: ${msg}`),
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
): Either<MoveParseError, MoveDescription> {
  let data;
  try {
    data = yaml.load(input);
  } catch (e) {
    return Left.create(new MoveParseError("error parsing YAML", { cause: e }));
  }
  const initParseResult = AllMoveDescriptionSchemas.safeParse(data);

  if (initParseResult.success) {
    const data = initParseResult.data;

    if (isV1ActionSchema(data)) {
      return Right.create(convertV1toV2(data));
    }

    return Right.create(data);
  } else {
    return Left.create(
      new MoveParseError("invalid move YAML", { cause: initParseResult.error }),
    );
  }
}
