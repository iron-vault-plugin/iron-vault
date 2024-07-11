import { CharacterContext } from "character-tracker";
import { ClockFileAdapter } from "clocks/clock-file";
import { ReadonlyIndex } from "indexer/index-interface";
import { TrackedEntities } from "te/index-interface";
import { ProgressTrackFileAdapter } from "tracks/progress";
import { projectedVersionedMap } from "utils/versioned-map";
import { ZodError } from "zod";
import { CampaignFile } from "./entity";

export class CampaignTrackedEntities implements TrackedEntities {
  constructor(
    private readonly base: TrackedEntities,
    public readonly campaign: CampaignFile,
    resolver: (path: string) => boolean,
  ) {
    const projection = <T>(value: T, key: string): T | undefined =>
      resolver(key) ? value : undefined;
    this.campaigns = projectedVersionedMap(this.base.campaigns, projection);
    this.characters = projectedVersionedMap(this.base.characters, projection);
    this.clocks = projectedVersionedMap(this.base.clocks, projection);
    this.progressTracks = projectedVersionedMap(
      this.base.progressTracks,
      projection,
    );
  }

  campaigns: ReadonlyIndex<CampaignFile, ZodError>;
  characters: ReadonlyIndex<CharacterContext, ZodError>;
  clocks: ReadonlyIndex<ClockFileAdapter, ZodError>;
  progressTracks: ReadonlyIndex<ProgressTrackFileAdapter, ZodError>;
}
