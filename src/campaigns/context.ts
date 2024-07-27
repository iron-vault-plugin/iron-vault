import { Asset, RulesPackage } from "@datasworn/core/dist/Datasworn";
import { CharacterContext } from "character-tracker";
import { ClockFileAdapter } from "clocks/clock-file";
import { BaseDataContext, ICompleteDataContext } from "datastore/data-context";
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

  get rulesPackages(): StandardIndex<RulesPackage> {
    return this.dataContext.rulesPackages;
  }

  get ruleset(): Ruleset {
    return this.dataContext.ruleset;
  }

  get prioritized() {
    return this.dataContext.prioritized;
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
