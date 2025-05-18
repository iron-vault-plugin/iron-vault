import { Index } from "indexer/index-interface";
import { BaseIndexer, IndexUpdate } from "indexer/indexer";
import { CachedMetadata, TFile } from "obsidian";
import { z } from "zod";
import { IronVaultKind } from "../constants";
import { CampaignFile } from "./entity";

export class CampaignIndexer extends BaseIndexer<CampaignFile, z.ZodError> {
  readonly id = IronVaultKind.Campaign;

  processFile(
    file: TFile,
    cache: CachedMetadata,
  ): IndexUpdate<CampaignFile, z.ZodError> {
    return CampaignFile.parse(file, cache.frontmatter);
  }

  protected reprocessRenamedFiles: boolean = true;
}

export type CampaignIndex = Index<CampaignFile, z.ZodError>;
