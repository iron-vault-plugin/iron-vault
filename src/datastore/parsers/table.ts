export const TABLE_REGEX =
  /^(\|?[^\n|]*(?:\|[^\n|]*)+\|?)$\n^(\|? *-{2,} *(?:\| *-{2,} *)*)\|?$((?:\n^\|?[^|\n]*(?:\|[^|\n]*)+\|?$)*)/gm;

export function tableRows(content: string): Array<Array<Array<string>>> {
  const tables: Array<Array<Array<string>>> = [];
  for (const tableMatch of content.matchAll(TABLE_REGEX)) {
    const rows: Array<Array<string>> = [];
    const dividerRow = tableMatch[2].split(/(?<!\\)\|/).map((s) => s.trim());

    const tableLines = content.trim().split("\n");
    for (const line of tableLines) {
      const interior = line
        .slice(
          line.startsWith("|") ? 1 : 0,
          line.length + (line.endsWith("|") ? -1 : 0),
        )
        .trim();
      rows.push(interior.split(/(?<!\\)\|/).map((s) => s.trim()));
    }
    tables.push(rows);
  }

  return tables;
}

// TODO: this doesn't account for multiple tables / a gap between tables
// export function parseTable(id: string, content: string): OracleTable {
//   const tables = content.matchAll(TABLE_REGEX);
//   for (const tableMatch of tables) {
//   }
// }
