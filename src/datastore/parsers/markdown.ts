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
  | { success: false; error: Error };
export type MarkdownDataParser = (
  content: string,
  baseName: string,
  metadata: Record<string, unknown> | undefined,
) => ParserReturn;

export function parserForFrontmatter(
  path: string,
  frontmatter: Record<string, unknown> | undefined,
): MarkdownDataParser | undefined {
  if (frontmatter?.["type"] == null) {
    return undefined;
  }
  switch (frontmatter["type"]) {
    // case "dataforged-inline":
    //   return dataforgedInlineParser;
    case "oracle_rollable":
      return inlineOracleParser;
    case "asset":
      return markdownAssetParser;
    default:
      console.warn(
        "[file: %s] unexpected value for `type` in frontmatter: %s",
        path,
        frontmatter?.["type"],
      );
      return undefined;
  }
}

// export function dataforgedInlineParser(content: string): ParserReturn {
//   const matches = content.match(
//     /^```[^\S\r\n]*data(forged|sworn)\s?\n([\s\S]+?)^```/m,
//   );
//   if (matches == null) {
//     return {
//       success: false,
//       error: new Error("no dataforged or datasworn block found"),
//     };
//   }

//   try {
//     const data = parseYaml(matches[1]);
//     // TODO: priority
//     // TODO: validation?
//     return { success: true, result: data as Datasworn.RulesPackage };
//   } catch (e) {
//     return {
//       success: false,
//       error:
//         e instanceof Error ? e : new Error("unexpected error", { cause: e }),
//     };
//   }
// }

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
      error:
        error instanceof Error
          ? error
          : new Error("unexpected error", { cause: error }),
    };
  }
}
