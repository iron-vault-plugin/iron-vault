import { type Datasworn } from "@datasworn/core";
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

const TEMPLATE_REGEX = /\[[^[\]]+\]\(id:([\w_\-/]+)\)/gi;

export function parseResultTemplate(
  input: string,
): Datasworn.OracleRollTemplate | undefined {
  const templateString = input.replace(TEMPLATE_REGEX, (_match, tableId) => {
    return `{{text:${tableId}}}`;
  });
  if (input !== templateString) {
    return { text: templateString };
  } else {
    return undefined;
  }
}

export function extractOracleTable(
  id: string,
  content: string,
): Omit<Datasworn.OracleTableText, "name" | "_source"> {
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
  const dice = header[0].match(/dice:\s*(.+)/i);
  if (!dice) {
    throw new Error(
      `expected first column header to be dice expression, found '${header[0]}'`,
    );
  }
  return {
    _id: id,
    type: "oracle_rollable",
    oracle_type: "table_text",
    column_labels: { roll: "Roll", text: header[1] },
    dice: dice[1].trim(),
    rows: body.map(([range, result], index) => {
      const parsedRange = parseRange(range);
      if (!parsedRange) {
        throw new Error(`invalid range ${range} in row ${index}`);
      }
      const { min, max } = parsedRange;
      const row: Datasworn.OracleTableRowText = {
        min,
        max,
        text: result,
      };
      const template = parseResultTemplate(result);
      if (template) {
        row.template = template;
      }
      return row;
    }),
  };
}
