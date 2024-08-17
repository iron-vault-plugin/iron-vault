import { CharacterContext } from "character-tracker";
import { ClockFileAdapter } from "clocks/clock-file";
import {
  BaseDataContext,
  ICompleteDataContext,
  trackTypesFromMoves,
} from "datastore/data-context";
import {
  DataIndexer,
  SourcedByArray,
  SourcedKindsArray,
} from "datastore/data-indexer";
import { DataswornIndexer, DataswornTypes } from "datastore/datasworn-indexer";
import { scopeTags } from "datastore/datasworn-symbols";
import IronVaultPlugin from "index";
import { ReadonlyIndex } from "indexer/index-interface";
import { OracleRoller } from "oracles/roller";
import { Ruleset } from "rules/ruleset";
import { TrackedEntities } from "te/index-interface";
import { ProgressTrackFileAdapter } from "tracks/progress";
import {
  AsyncDiceRoller,
  DiceRoller,
  GraphicalDiceRoller,
  PlainDiceRoller,
} from "utils/dice-roller";
import { projectedVersionedMap } from "utils/versioned-map";
import { ZodError } from "zod";
import { CampaignFile } from "./entity";
import { Determination, IPlaysetConfig } from "./playsets/config";

export class CampaignDataContext
  implements TrackedEntities, ICompleteDataContext
{
  readonly dataContext: PlaysetAwareDataContext;
  readonly oracleRoller: OracleRoller;

  constructor(
    // TODO(@cwegrzyn): Once we have a campaign settings object (which must overlay the
    //   overall plugin settings somehow), we can replace this plugin call.
    private readonly plugin: IronVaultPlugin,
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
    this.oracleRoller = new OracleRoller(plugin, this.oracles);
  }

  campaigns: ReadonlyIndex<CampaignFile, ZodError>;
  characters: ReadonlyIndex<CharacterContext, ZodError>;
  clocks: ReadonlyIndex<ClockFileAdapter, ZodError>;
  progressTracks: ReadonlyIndex<ProgressTrackFileAdapter, ZodError>;

  get moves() {
    return this.dataContext.moves;
  }

  get assets() {
    return this.dataContext.assets;
  }

  get moveCategories() {
    return this.dataContext.moveCategories;
  }

  get oracles() {
    return this.dataContext.oracles;
  }

  get truths() {
    return this.dataContext.truths;
  }

  get rulesPackages() {
    return this.dataContext.rulesPackages;
  }

  get ruleset(): Ruleset {
    return this.dataContext.ruleset;
  }

  get prioritized() {
    return this.dataContext.prioritized;
  }

  get trackTypes() {
    return trackTypesFromMoves(this.moves);
  }

  diceRollerFor(kind: "move"): AsyncDiceRoller & DiceRoller {
    switch (kind) {
      case "move":
        return this.plugin.settings.graphicalActionDice
          ? new GraphicalDiceRoller(this.plugin)
          : PlainDiceRoller.INSTANCE;
      default:
        throw new Error(`unexpected kind ${kind}`);
    }
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
              // TODO(@cwegrzyn): maybe I should be more open ended with the type on determine's obj?
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              playsetConfig.determine(sourced.id, {
                tags: sourced.value[scopeTags],
              }) === Determination.Include,
          );
          return filtered.length > 0
            ? (filtered as SourcedByArray<DataswornTypes>)
            : undefined;
        },
      ),
    );
  }
}
