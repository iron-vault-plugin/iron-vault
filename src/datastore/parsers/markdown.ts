import { OracleTableSimple, RulesPackage } from "@datasworn/core";
import { CachedMetadata, TFile, parseYaml } from "obsidian";
import { extractOracleTable } from "./oracle-table";

export type ParserReturn =
  | { success: true; priority?: number; rules: RulesPackage }
  | { success: false; error: Error };
export type MarkdownDataParser = (content: string) => ParserReturn;

export function parserForFrontmatter(
  file: TFile,
  metadata: CachedMetadata | null,
): MarkdownDataParser | undefined {
  if (metadata?.frontmatter?.forged == null) {
    return undefined;
  }
  switch (metadata.frontmatter.forged) {
    case "dataforged-inline":
      return dataforgedInlineParser;
    case "inline-oracle":
      return inlineOracleParser(file.basename);
    default:
      console.warn(
        "[file: %s] unexpected value for `forged` in frontmatter: %s",
        file.path,
        metadata.frontmatter?.forged,
      );
      return undefined;
  }
}

export function dataforgedInlineParser(content: string): ParserReturn {
  const matches = content.match(
    /^```[^\S\r\n]*data(forged|sworn)\s?\n([\s\S]+?)^```/m,
  );
  if (matches == null) {
    return {
      success: false,
      error: new Error("no dataforged or datasworn block found"),
    };
  }

  try {
    const data = parseYaml(matches[1]);
    // TODO: priority
    // TODO: validation?
    return { success: true, rules: data as RulesPackage };
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error ? e : new Error("unexpected error", { cause: e }),
    };
  }
}

export function inlineOracleParser(baseName: string): MarkdownDataParser {
  const id = `user_inlineoracle_${baseName.replace(/\s+/, "_")}`;
  // TODO: what should source be?
  const source = {
    authors: [{ name: "User" }],
    date: "0000-00-00",
    license: "???",
    title: "User",
    url: "https://example.com",
  };
  return (content: string) => {
    try {
      const table = extractOracleTable(
        `user/collections/oracles/${id}`,
        content,
      );
      const fullTable: OracleTableSimple = { ...table, name: baseName, source };
      return {
        success: true,
        rules: {
          datasworn_version: "0.0.5",
          id,
          package_type: "expansion",
          ruleset: "starforged", // TODO: not sure how to handle this
          oracles: {
            user: {
              id: "user/collections/oracles/user",
              source,
              oracle_type: "tables",
              name: "User",
              contents: {
                table: fullTable,
              },
            },
          },
        },
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
  };
}
