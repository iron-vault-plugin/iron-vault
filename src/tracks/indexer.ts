import { CachedMetadata } from "obsidian";
import { z } from "zod";
import { IronVaultKind } from "../constants";
import { BaseIndexer, IndexOf, IndexUpdate } from "../indexer/indexer";
import { ProgressTrackFileAdapter } from "./progress";

export class ProgressIndexer extends BaseIndexer<
  ProgressTrackFileAdapter,
  z.ZodError
> {
  readonly id = IronVaultKind.ProgressTrack;

  processFile(
    path: string,
    cache: CachedMetadata,
  ): IndexUpdate<ProgressTrackFileAdapter, z.ZodError> {
    return ProgressTrackFileAdapter.create(cache.frontmatter);
  }
}

export type ProgressIndex = IndexOf<ProgressIndexer>;
