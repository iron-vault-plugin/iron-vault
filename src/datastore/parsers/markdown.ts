import { DataswornSource, type Datasworn } from "@datasworn/core";
import { markdownAssetToDatasworn } from "./markdown-asset";
import { extractOracleTable } from "./oracle-table";

export type ParserReturn =
  | {
      success: true;
      priority?: number;
      result:
        | DataswornSource.OracleRollableTable
        | DataswornSource.Move
        | DataswornSource.Asset;
    }
  | {
      success: false;
      error: Error;
      result?: { type?: string };
    };
export type MarkdownDataParser = (
  content: string,
  baseName: string,
  metadata: Record<string, unknown> | undefined,
) => ParserReturn;

export const PARSERS_BY_TYPE: Record<string, MarkdownDataParser> = {
  oracle_rollable: inlineOracleParser,
  asset: markdownAssetParser,
};

export function markdownAssetParser(
  content: string,
  baseName: string,
  metadata: Record<string, unknown> | undefined,
): ParserReturn {
  // TODO: what should source be?
  const source: Datasworn.SourceInfo = {
    authors: [{ name: "User" }],
    date: "0000-00-00",
    license: null,
    title: `Oracles from ${baseName}`,
    url: "https://example.com",
  };
  const table = markdownAssetToDatasworn(content);

  if (table.isLeft()) {
    return {
      success: false,
      error: table.error,
      result: { type: "asset" },
    };
  }
  const fullTable: DataswornSource.Asset = {
    ...table.value,
    ...metadata,
    _source: source,
  };
  return {
    success: true,
    result: fullTable,
  };
}

export function inlineOracleParser(
  content: string,
  baseName: string,
  metadata: Record<string, unknown> | undefined,
): ParserReturn {
  // TODO: what should source be?
  const source: Datasworn.SourceInfo = {
    authors: [{ name: "User" }],
    date: "0000-00-00",
    license: null,
    title: `Oracles from ${baseName}`,
    url: "https://example.com",
  };
  try {
    const table = extractOracleTable(content);
    const fullTable: DataswornSource.OracleTableText = {
      ...metadata,
      ...table,
      name: (metadata?.name as string | undefined) ?? baseName,
      _source: source,
    };
    return {
      success: true,
      result: fullTable,
    };
  } catch (error) {
    return {
      success: false,
      result: { type: "oracle_rollable" },
      error:
        error instanceof Error
          ? error
          : new Error("unexpected error", { cause: error }),
    };
  }
}
