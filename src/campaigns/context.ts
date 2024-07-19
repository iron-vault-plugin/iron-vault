import { Asset } from "@datasworn/core/dist/Datasworn";
import { CharacterContext } from "character-tracker";
import { IDataContext } from "characters/action-context";
import { ClockFileAdapter } from "clocks/clock-file";
import {
  DataIndexer,
  SourcedByArray,
  SourcedKindsArray,
  SourcedMap,
  SourcedMapImpl,
  StandardIndex,
} from "datastore/data-indexer";
import {
  DataswornIndexer,
  DataswornTypes,
  MoveWithSelector,
} from "datastore/datasworn-indexer";
import { ReadonlyIndex } from "indexer/index-interface";
import { TrackedEntities } from "te/index-interface";
import { ProgressTrackFileAdapter } from "tracks/progress";
import { ProjectableMap, projectedVersionedMap } from "utils/versioned-map";
import { ZodError } from "zod";
import { CampaignFile } from "./entity";
import { Determination, IPlaysetConfig } from "./playsets/config";

export class CampaignDataContext implements TrackedEntities, IDataContext {
  dataContext: PlaysetAwareDataContext;

  constructor(
    base: TrackedEntities,
    indexer: DataIndexer<DataswornTypes>,
    public readonly campaign: CampaignFile,
    resolver: (path: string) => boolean,
  ) {
    const projection = <T>(value: T, key: string): T | undefined =>
      resolver(key) ? value : undefined;
    this.campaigns = projectedVersionedMap(base.campaigns, projection);
    this.characters = projectedVersionedMap(base.characters, projection);
    this.clocks = projectedVersionedMap(base.clocks, projection);
    this.progressTracks = projectedVersionedMap(
      base.progressTracks,
      projection,
    );

    this.dataContext = new PlaysetAwareDataContext(indexer, campaign.playset);
  }

  get moves(): StandardIndex<MoveWithSelector> {
    return this.dataContext.moves;
  }

  get assets(): StandardIndex<Asset> {
    return this.dataContext.assets;
  }

  campaigns: ReadonlyIndex<CampaignFile, ZodError>;
  characters: ReadonlyIndex<CharacterContext, ZodError>;
  clocks: ReadonlyIndex<ClockFileAdapter, ZodError>;
  progressTracks: ReadonlyIndex<ProgressTrackFileAdapter, ZodError>;
}

export type DataswornIndex = ProjectableMap<
  string,
  SourcedByArray<DataswornTypes>
>;

// TODO(@cwegrzyn): make this cacheable
export class PlaysetAwareDataContext implements IDataContext {
  readonly internal: DataswornIndex;
  readonly prioritized: SourcedMap<DataswornTypes>;

  constructor(base: DataswornIndexer, playsetConfig: IPlaysetConfig) {
    this.internal = base.projected<SourcedByArray<DataswornTypes>>(
      <K extends keyof DataswornTypes>(
        val: SourcedKindsArray<DataswornTypes>[K],
        _key: string,
      ) => {
        // NOTE: we look at the source id here instead of the key, in case things are indexed elsewhere
        const filtered = val.filter(
          (sourced) =>
            playsetConfig.determine(sourced.id) === Determination.Include,
        );
        return filtered.length > 0
          ? (filtered as SourcedByArray<DataswornTypes>)
          : undefined;
      },
    );
    this.prioritized = new SourcedMapImpl<DataswornTypes, keyof DataswornTypes>(
      this.internal,
    );
  }

  get moves(): StandardIndex<MoveWithSelector> {
    return this.prioritized.ofKind("move").projected((entry) => entry.value);
  }

  get assets(): StandardIndex<Asset> {
    return this.prioritized.ofKind("asset").projected((entry) => entry.value);
  }
}
