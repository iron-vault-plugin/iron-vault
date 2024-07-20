import { Asset, RulesPackage } from "@datasworn/core/dist/Datasworn";
import { CharacterContext } from "character-tracker";
import { ClockFileAdapter } from "clocks/clock-file";
import { BaseDataContext, IDataContext } from "datastore/data-context";
import {
  DataIndexer,
  SourcedByArray,
  SourcedKindsArray,
  StandardIndex,
} from "datastore/data-indexer";
import {
  DataswornIndexer,
  DataswornTypes,
  MoveWithSelector,
} from "datastore/datasworn-indexer";
import { ReadonlyIndex } from "indexer/index-interface";
import { OracleRoller } from "oracles/roller";
import { Ruleset } from "rules/ruleset";
import { TrackedEntities } from "te/index-interface";
import { ProgressTrackFileAdapter } from "tracks/progress";
import { projectedVersionedMap } from "utils/versioned-map";
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

  campaigns: ReadonlyIndex<CampaignFile, ZodError>;
  characters: ReadonlyIndex<CharacterContext, ZodError>;
  clocks: ReadonlyIndex<ClockFileAdapter, ZodError>;
  progressTracks: ReadonlyIndex<ProgressTrackFileAdapter, ZodError>;

  get moves(): StandardIndex<MoveWithSelector> {
    return this.dataContext.moves;
  }

  get assets(): StandardIndex<Asset> {
    return this.dataContext.assets;
  }

  get moveCategories() {
    return this.dataContext.moveCategories;
  }

  get moveRulesets() {
    return this.dataContext.moveRulesets;
  }

  get oracles() {
    return this.dataContext.oracles;
  }

  get truths() {
    return this.dataContext.truths;
  }

  get roller(): OracleRoller {
    return this.dataContext.roller;
  }

  get rulesPackages(): StandardIndex<RulesPackage> {
    return this.dataContext.rulesPackages;
  }

  get ruleset(): Ruleset {
    return this.dataContext.ruleset;
  }
}

export class PlaysetAwareDataContext extends BaseDataContext {
  constructor(base: DataswornIndexer, playsetConfig: IPlaysetConfig) {
    super(
      base.projected<SourcedByArray<DataswornTypes>>(
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
      ),
    );
  }
}
