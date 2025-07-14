import { Datasworn, DataswornSource } from "@datasworn/core";
import { Result } from "true-myth/result";

import { FileProblem } from "@ironvault/datasworn-compiler";

export type IndexCommand =
  | {
      type: "addRoot";
      root: string; // The root path of the package to be added
    }
  | {
      type: "removeRoot";
      root: string;
    }
  | {
      type: "setMetaRoot";
      root: string | null;
    }
  | {
      type: "index";
      path: string; // The path to the file to be indexed
      mtime: number; // The last modified time of the file
      content: string; // The content of the file to be indexed
      frontmatter: Record<string, unknown> | undefined; // The frontmatter of the file, if any
    }
  | {
      type: "delete";
      path: string;
    }
  | { type: "rename"; oldPath: string; newPath: string }
  | { type: "debug" };

export type IndexResult =
  | {
      type: "updated";
      path: string;
    }
  | {
      type: "updated:package";
      root: string; // The root path of the package that was updated
      package: Datasworn.RulesPackage | null; // The updated content of the package
      files: Map<string, Result<DataswornSource.RulesPackage, FileProblem>>; // Any errors encountered during indexing, mapped by path
    };
