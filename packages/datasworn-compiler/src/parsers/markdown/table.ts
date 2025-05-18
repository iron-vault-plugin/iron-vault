// TODO: this doesn't support slash escaping pipes
const TABLE_REGEX =
  /^( *(\|?)[^\n|]*(?:\|[^\n|]*)+\2 *)$\n^( *\2 *:?-{2,}:? *(?:\| *:?-{2,}:? *)*\2 *)$((?:\n^ *\2[^|\n]*(?:\|[^|\n]*)+\2 *$)*)/gm;

export enum MarkdownTableAlignment {
  Default,
  Left,
  Right,
  Center,
}

export interface MarkdownTable {
  columnAlignments: MarkdownTableAlignment[];
  header: Array<string>;
  body: Array<Array<string>>;
}

export class MalformedMarkdownTableError extends Error {}

export function splitTableRow(row: string): string[] {
  const segments = row.split(/[^\\]?\|/).map((s) => s.trim());
  if (segments[0] === "") {
    segments.shift();
  }
  if (segments[segments.length - 1] === "") {
    segments.pop();
  }
  return segments;
}

function parseTable(match: RegExpMatchArray): MarkdownTable {
  // TODO: handle alignments
  const columnAlignments = splitTableRow(match[3].trim()).map(
    (_) => MarkdownTableAlignment.Default,
  );
  const header = splitTableRow(match[1].trim());

  if (columnAlignments.length != header.length) {
    throw new MalformedMarkdownTableError(
      `header has ${header.length} cols, but divider has ${columnAlignments.length}`,
    );
  }

  const body = match[4].split("\n").flatMap((line) => {
    line = line.trim();
    if (line === "") {
      return [];
    }
    const row = splitTableRow(line).slice(0, columnAlignments.length);
    return [row];
  });

  return {
    columnAlignments,
    header,
    body,
  };
}

export function matchTable(content: string): MarkdownTable {
  for (const reg of content.matchAll(TABLE_REGEX)) {
    return parseTable(reg);
  }
  throw new MalformedMarkdownTableError("no table found");
}

export function matchTables(content: string): MarkdownTable[] {
  const tables: Array<MarkdownTable> = [];
  for (const tableMatch of content.matchAll(TABLE_REGEX)) {
    tables.push(parseTable(tableMatch));
  }

  return tables;
}
