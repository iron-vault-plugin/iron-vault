import { DataswornSource, type Datasworn } from "@datasworn/core";
import { Dice } from "utils/dice";
import { NumberRange } from "../../model/rolls";
import { matchTables } from "./table";

export function parseRange(input: string): NumberRange | undefined {
  const results = input.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!results) {
    return undefined;
  }
  const min = Number.parseInt(results[1]);
  if (Number.isNaN(min)) {
    return undefined;
  }
  let max: number;
  if (results[2]) {
    max = Number.parseInt(results[2]);
    if (Number.isNaN(max)) {
      return undefined;
    }
  } else {
    max = min;
  }
  return {
    min,
    max,
  };
}

export function parseRanges(input: string): NumberRange[] | undefined {
  const ranges = input.split(";").map((r) => parseRange(r.trim()));
  if (ranges.some((r) => r == null)) {
    return undefined;
  }
  return ranges as NumberRange[];
}

const TEMPLATE_REGEX = /\[[^[\]]+\]\(([\w.]+:[\w_\-/]+)\)/gi;

export function parseResultTemplate(
  input: string,
): Datasworn.OracleRollTemplate | undefined {
  const templateString = input.replace(TEMPLATE_REGEX, (_match, tableId) => {
    return `{{text>${tableId}}}`;
  });
  if (input !== templateString) {
    return { text: templateString };
  } else {
    return undefined;
  }
}

/** Given a dice combination and a set of range values for each die, flatten the ranges
 * into a set of ranges for a single flattened dice.
 * For example, given 1d6;1d6 and ranges 1-2;3-4, the result would be [[3-4, 9-10]].
 */
export function flattenRangeExpr(dice: Dice[], input: string): NumberRange[] {
  const ranges = parseRanges(input);
  if (!ranges) {
    throw new Error(`invalid range expression ${input}`);
  }

  if (ranges.length != dice.length) {
    throw new Error(
      `expected ${dice.length} ranges, found ${ranges.length}: ${input}`,
    );
  }

  function recurse(
    index: number,
    rowRanges: NumberRange[],
    placeValue: number,
  ): NumberRange[] {
    if (index < 0) {
      return rowRanges;
    }
    const newRanges: NumberRange[] = [];
    const placeDice = dice[index];
    const placeRange = ranges![index];
    if (rowRanges.length === 0) {
      return recurse(index - 1, [placeRange], placeValue * placeDice.sides);
    }
    for (const r of rowRanges) {
      for (let i = placeRange.min; i <= placeRange.max; i++) {
        newRanges.push({
          min: r.min + (i - 1) * placeValue,
          max: r.max + (i - 1) * placeValue,
        });
      }
    }
    return recurse(index - 1, newRanges, placeValue * placeDice.sides);
  }

  return recurse(ranges.length - 1, [], 1);
}

export function parseDiceHeader(input: string): Dice[] | undefined {
  const results = input.match(/dice:\s*(.+)/i);
  if (!results) {
    return undefined;
  }
  const dice = results[1];
  try {
    return dice.split(";").map((s) => Dice.fromDiceString(s.trim()));
  } catch (_e) {
    return undefined;
  }
}

/** Given a dice combination, flatten to a single roll  if possible. */
export function flattenDiceCombination(dice: Dice[]): Dice {
  if (dice.length === 1) {
    return dice[0];
  }
  return new Dice(
    1,
    dice.reduceRight((acc, d) => {
      if (d.count > 1) {
        throw new Error("cannot flatten dice with multiple counts");
      }
      return acc * d.sides;
    }, 1),
  );
}

export function extractOracleTable(
  content: string,
): Omit<DataswornSource.EmbeddedOracleTableText, "name"> {
  const tables = matchTables(content);
  if (tables.length != 1) {
    throw new Error(`expected 1 table, found ${tables.length}`);
  }
  const { header, columnAlignments, body } = tables[0];
  if (columnAlignments.length != 2) {
    throw new Error(
      `expected 2 columns, found ${columnAlignments.length} (${header})`,
    );
  }
  const dice = parseDiceHeader(header[0]);
  if (!dice) {
    throw new Error(
      `expected first column header to be dice expression, found '${header[0]}'`,
    );
  }
  const flattenedDice = flattenDiceCombination(dice);

  return {
    type: "oracle_rollable",
    oracle_type: "table_text",
    column_labels: { roll: "Roll", text: header[1] },
    dice: flattenedDice.toString(),
    rows: body
      .flatMap(([range, result], index) => {
        const parsedRanges = flattenRangeExpr(dice, range);
        if (!parsedRanges) {
          throw new Error(`invalid range ${range} in row ${index}`);
        }
        return parsedRanges.map((parsedRange) => {
          const { min, max } = parsedRange;
          const text = result.replaceAll("<br>", "\n\n");
          const row: DataswornSource.OracleRollableRowText = {
            roll: { min, max },
            text,
          };
          const template = parseResultTemplate(text);
          if (template) {
            row.template = template;
          }
          return row;
        });
      })
      .sort((a, b) => {
        if (a.roll?.min != b.roll?.min) {
          return (a.roll?.min ?? 0) - (b.roll?.min ?? 0);
        }
        if (a.roll?.max != b.roll?.max) {
          return (a.roll?.max ?? 0) - (b.roll?.max ?? 0);
        }
        return 0;
      }),
  };
}
