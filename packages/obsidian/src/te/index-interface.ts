import { CampaignFile } from "campaigns/entity";
import { CharacterContext } from "character-tracker";
import { ClockFileAdapter } from "clocks/clock-file";
import { ReadonlyIndex } from "indexer/index-interface";
import { UnexpectedIndexingError } from "indexer/indexer";
import { ProgressTrackFileAdapter } from "tracks/progress";
import { ZodError } from "zod";

export interface TrackedEntities {
  readonly campaigns: ReadonlyIndex<
    CampaignFile,
    ZodError | UnexpectedIndexingError
  >;
  readonly characters: ReadonlyIndex<
    CharacterContext,
    ZodError | UnexpectedIndexingError
  >;
  readonly clocks: ReadonlyIndex<
    ClockFileAdapter,
    ZodError | UnexpectedIndexingError
  >;
  readonly progressTracks: ReadonlyIndex<
    ProgressTrackFileAdapter,
    ZodError | UnexpectedIndexingError
  >;
}
