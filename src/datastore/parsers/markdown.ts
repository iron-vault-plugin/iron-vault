import { DataswornSource, type Datasworn } from "@datasworn/core";
import { CachedMetadata, TFile } from "obsidian";
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
  parent: { type: string },
) => ParserReturn;

export function parserForFrontmatter(
  file: TFile,
  metadata: CachedMetadata | null,
): MarkdownDataParser | undefined {
  if (metadata?.frontmatter?.["iron-vault"] == null) {
    return undefined;
  }
  switch (metadata.frontmatter["iron-vault"]) {
    // case "dataforged-inline":
    //   return dataforgedInlineParser;
    case "inline-oracle":
      return inlineOracleParser;
    default:
      console.warn(
        "[file: %s] unexpected value for `iron-vault` in frontmatter: %s",
        file.path,
        metadata.frontmatter?.["iron-vault"],
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

export function inlineOracleParser(
  content: string,
  baseName: string,
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
    const table = extractOracleTable(undefined, content);
    const fullTable: DataswornSource.OracleTableText = {
      ...table,
      name: baseName,
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
