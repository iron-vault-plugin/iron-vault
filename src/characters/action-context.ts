import { CampaignTrackedEntities } from "campaigns/context";
import { determineCampaignContext } from "campaigns/manager";
import { StandardIndex } from "datastore/data-indexer";
import { DataswornTypes, moveOrigin } from "datastore/datasworn-indexer";
import { produce } from "immer";
import { App, MarkdownFileInfo } from "obsidian";
import { ConditionMeterDefinition } from "rules/ruleset";
import { vaultProcess } from "utils/obsidian";
import { CharacterContext, activeCharacter } from "../character-tracker";
import {
  CharReader,
  CharacterLens,
  MOMENTUM_METER_DEFINITION,
  MeterWithLens,
  MeterWithoutLens,
  ValidatedCharacter,
  meterLenses,
  movesReader,
  rollablesReader,
} from "../characters/lens";
import { type Datastore } from "../datastore";
import IronVaultPlugin from "../index";
import { InfoModal } from "../utils/ui/info";

export interface IDataContext {
  readonly moves: StandardIndex<DataswornTypes["move"]>;
  readonly assets: StandardIndex<DataswornTypes["asset"]>;
}

export interface IActionContext extends IDataContext {
  readonly campaignContext: CampaignTrackedEntities;
  readonly kind: "no_character" | "character";
  readonly rollables: (MeterWithLens | MeterWithoutLens)[];
  readonly conditionMeters: (
    | MeterWithLens<ConditionMeterDefinition>
    | MeterWithoutLens<ConditionMeterDefinition>
  )[];

  readonly momentum?: number;

  getWithLens<T>(op: (lenses: CharacterLens) => CharReader<T>): T | undefined;
}

export class NoCharacterActionConext implements IActionContext {
  readonly kind = "no_character";
  readonly momentum: undefined = undefined;

  constructor(
    public readonly datastore: Datastore,
    public readonly campaignContext: CampaignTrackedEntities,
  ) {}

  get moves() {
    return this.datastore.moves;
  }

  get assets() {
    return this.datastore.assets;
  }

  get rollables(): MeterWithoutLens[] {
    return Object.entries(this.datastore.ruleset.stats).map(([key, stat]) => ({
      key,
      definition: stat,
      lens: undefined,
      value: undefined,
    }));
  }

  getWithLens<T>(_op: (lenses: CharacterLens) => CharReader<T>): undefined {
    return undefined;
  }

  get conditionMeters(): MeterWithoutLens<ConditionMeterDefinition>[] {
    return [
      ...Object.entries(this.datastore.ruleset.condition_meters).map(
        ([key, definition]) => ({
          key,
          definition,
          lens: undefined,
          value: undefined,
        }),
      ),
      MOMENTUM_METER_DEFINITION,
    ];
  }
}

export class CharacterActionContext implements IActionContext {
  readonly kind = "character";
  #moves?: StandardIndex<DataswornTypes["move"]>;

  constructor(
    public readonly datastore: Datastore,
    public readonly campaignContext: CampaignTrackedEntities,
    public readonly characterPath: string,
    public readonly characterContext: CharacterContext,
  ) {}

  get assets(): StandardIndex<DataswornTypes["asset"]> {
    return this.datastore.assets;
  }

  get moves(): StandardIndex<DataswornTypes["move"]> {
    if (!this.#moves) {
      // TODO: might want to rethink this given the new set up.
      const characterMoves = movesReader(this.characterContext.lens, this)
        .get(this.characterContext.character)
        .expect("unexpected failure finding assets for moves");
      // .map(({ move, asset }) =>
      //   produce(move, (draft) => {
      //     draft.name = `${asset.name}: ${move.name}`;
      //   }),
      // );
      this.#moves = this.datastore.moves.projected((move) => {
        if (move[moveOrigin].assetId == null) return move;
        const assetMove = characterMoves.find(
          ({ move: characterMove }) => move._id === characterMove._id,
        );
        if (assetMove) {
          return produce(move, (draft) => {
            draft.name = `${assetMove.asset.name}: ${draft.name}`;
          });
        }
        return undefined;
      });
    }
    return this.#moves;
  }

  get rollables(): MeterWithLens[] {
    return rollablesReader(this.characterContext.lens, this).get(
      this.characterContext.character,
    );
  }

  get momentum() {
    return this.characterContext.lens.momentum.get(
      this.characterContext.character,
    );
  }

  getWithLens<T>(op: (lenses: CharacterLens) => CharReader<T>): T {
    return op(this.characterContext.lens).get(this.characterContext.character);
  }

  get conditionMeters(): MeterWithLens<ConditionMeterDefinition>[] {
    const { character, lens } = this.characterContext;
    return meterLenses(lens, character, this);
  }

  async update(
    app: App,
    updater: (
      obj: ValidatedCharacter,
      context: CharacterContext,
    ) => ValidatedCharacter,
  ) {
    return await this.characterContext.updater(
      vaultProcess(app, this.characterPath),
      updater,
    );
  }
}

export type ActionContext = CharacterActionContext | NoCharacterActionConext;

function renderError(e: Error, el: HTMLElement): void {
  el.createEl("pre", { text: `${e.name}: ${e.message}` });
  if (e.cause instanceof Error) {
    el.createEl("p", { text: "Caused by:" });
    renderError(e.cause, el);
  }
}

export class NoValidContextError extends Error {}

export async function requireActiveCharacterContext(
  plugin: IronVaultPlugin,
  view?: MarkdownFileInfo,
): Promise<CharacterActionContext> {
  const context = await determineCharacterActionContext(plugin, view);
  if (!(context instanceof CharacterActionContext)) {
    await InfoModal.show(
      plugin.app,
      "Command requires an active character, but character system is disabled.",
    );
    throw new NoValidContextError(
      "Command requires an active character, but character system is disabled.",
    );
  }

  return context;
}

export async function determineCharacterActionContext(
  plugin: IronVaultPlugin,
  view?: MarkdownFileInfo,
): Promise<ActionContext> {
  const campaignContext = await determineCampaignContext(plugin, view);
  if (plugin.settings.useCharacterSystem) {
    try {
      const [characterPath, characterContext] = await activeCharacter(
        plugin,
        campaignContext,
      );
      return new CharacterActionContext(
        plugin.datastore,
        campaignContext,
        characterPath,
        characterContext,
      );
    } catch (e) {
      const div = document.createElement("div");
      div.createEl("p", {
        text: `An error occurred while finding your active character`,
      });
      if (e instanceof Error) {
        renderError(e, div);
      } else {
        div.createEl("pre", {
          text: `${e}`,
        });
      }

      await InfoModal.show(plugin.app, div);
      throw new NoValidContextError("No valid character found", { cause: e });
    }
  } else {
    return new NoCharacterActionConext(plugin.datastore, campaignContext);
  }
}
