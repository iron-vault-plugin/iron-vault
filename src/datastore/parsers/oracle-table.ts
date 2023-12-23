import {
  OracleRollTemplate,
  OracleTableRowSimple,
  OracleTableSimple,
} from "@datasworn/core";
import { matchTables } from "./table";

export interface Range {
  min: number;
  max: number;
}

export function parseRange(input: string): Range | undefined {
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

const TEMPLATE_REGEX = /\[[^\[\]]+\]\(id:([\w_\-/]+)\)/gi;

export function parseResultTemplate(
  input: string,
): OracleRollTemplate | undefined {
  const templateString = input.replace(TEMPLATE_REGEX, (_match, tableId) => {
    return `{{result:${tableId}}}`;
  });
  if (input !== templateString) {
    return { result: templateString };
  } else {
    return undefined;
  }
}

export function extractOracleTable(
  id: string,
  content: string,
): Partial<OracleTableSimple> {
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
    oracle_type: "table_simple",
    id,
    column_labels: { roll: "Roll", result: header[1] },
    dice: dice[1].trim(),
    rows: body.map(([range, result], index) => {
      const parsedRange = parseRange(range);
      if (!parsedRange) {
        throw new Error(`invalid range ${range} in row ${index}`);
      }
      const { min, max } = parsedRange;
      const row: OracleTableRowSimple = {
        id: `${id}/${min}-${max}`,
        min,
        max,
        result: result,
      };
      const template = parseResultTemplate(result);
      if (template) {
        row.template = template;
      }
      return row;
    }),
  };
}
