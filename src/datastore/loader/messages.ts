import { DataswornSource } from "@datasworn/core";
import { Either } from "utils/either";

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
  | { type: "rename"; oldPath: string; newPath: string };

export type IndexResult =
  | {
      type: "updated";
      path: string;
    }
  | {
      type: "updated:package";
      root: string; // The root path of the package that was updated
      content: [string, Either<Error, DataswornSource.RulesPackage>][]; // The content of the package, or null if it was deleted
    };
