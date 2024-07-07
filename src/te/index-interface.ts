import { CampaignIndex } from "campaigns/indexer";
import { CharacterTracker } from "character-tracker";
import { ClockIndex } from "clocks/clock-file";
import { ProgressIndex } from "tracks/indexer";

export interface TrackedEntities {
  readonly campaigns: CampaignIndex;
  readonly characters: CharacterTracker;
  readonly clocks: ClockIndex;
  readonly progressTracks: ProgressIndex;
}
