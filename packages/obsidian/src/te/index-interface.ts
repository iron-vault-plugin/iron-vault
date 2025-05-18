import { CampaignFile } from "campaigns/entity";
import { CharacterContext } from "character-tracker";
import { ClockFileAdapter } from "clocks/clock-file";
import { ReadonlyIndex } from "indexer/index-interface";
import { ProgressTrackFileAdapter } from "tracks/progress";
import { ZodError } from "zod";

export interface TrackedEntities {
  readonly campaigns: ReadonlyIndex<CampaignFile, ZodError>;
  readonly characters: ReadonlyIndex<CharacterContext, ZodError>;
  readonly clocks: ReadonlyIndex<ClockFileAdapter, ZodError>;
  readonly progressTracks: ReadonlyIndex<ProgressTrackFileAdapter, ZodError>;
}
