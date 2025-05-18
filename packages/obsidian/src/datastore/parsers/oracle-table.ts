import { DataswornSource, type Datasworn } from "@datasworn/core";
import { Dice } from "utils/dice";
import {
  flattenDiceCombination,
  flattenRangeExpr,
} from "utils/dicestuff/combos";
import { matchTables } from "./table";

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
