import type { StricliAutoCompleteContext } from "@stricli/auto-complete";
import type { CommandContext } from "@stricli/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface LocalContext
  extends CommandContext,
    StricliAutoCompleteContext {
  readonly process: NodeJS.Process;
  readonly fs: {
    readonly promises: Pick<
      typeof import("fs").promises,
      "readFile" | "writeFile" | "mkdir" | "readdir"
    >;
  };
  readonly path: Pick<
    typeof import("path"),
    "join" | "basename" | "resolve" | "relative"
  >;
}

export function buildContext(process: NodeJS.Process): LocalContext {
  return {
    process,
    os,
    fs,
    path,
  };
}
