import { CampaignDataContext } from "campaigns/context";
import { determineCampaignContext } from "campaigns/manager";
import { IDataContext } from "datastore/data-context";
import { StandardIndex } from "datastore/data-indexer";
import { DataswornTypes } from "datastore/datasworn-indexer";
import { moveOrigin } from "datastore/datasworn-symbols";
import { produce } from "immer";
import { App, MarkdownFileInfo, Notice } from "obsidian";
import { OracleRoller } from "oracles/roller";
import { ConditionMeterDefinition, Ruleset } from "rules/ruleset";
import { vaultProcess } from "utils/obsidian";
import {
  CharacterContext,
  requireActiveCharacterForCampaign,
} from "../character-tracker";
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
import IronVaultPlugin from "../index";
import { InfoModal } from "../utils/ui/info";
import { InvalidCharacterError } from "./errors";

export interface IActionContext extends IDataContext {
  readonly campaignContext: CampaignDataContext;
  readonly kind: "no_character" | "character";
  readonly rollables: (MeterWithLens | MeterWithoutLens)[];
  readonly conditionMeters: (
    | MeterWithLens<ConditionMeterDefinition>
    | MeterWithoutLens<ConditionMeterDefinition>
  )[];

  readonly oracleRoller: OracleRoller;

  readonly momentum?: number;

  getWithLens<T>(op: (lenses: CharacterLens) => CharReader<T>): T | undefined;
}

export class NoCharacterActionConext implements IActionContext {
  readonly kind = "no_character";
  readonly momentum: undefined = undefined;

  constructor(public readonly campaignContext: CampaignDataContext) {}

  get oracleRoller(): OracleRoller {
    return this.campaignContext.oracleRoller;
  }

  get rulesPackages() {
    return this.campaignContext.rulesPackages;
  }

  get ruleset(): Ruleset {
    return this.campaignContext.ruleset;
  }

  get moves() {
    return this.campaignContext.moves;
  }

  get assets() {
    return this.campaignContext.assets;
  }

  get moveCategories() {
    return this.campaignContext.moveCategories;
  }

  get oracles() {
    return this.campaignContext.oracles;
  }

  get truths() {
    return this.campaignContext.truths;
  }

  get rollables(): MeterWithoutLens[] {
    return Object.entries(this.ruleset.stats).map(([key, stat]) => ({
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
      ...Object.entries(this.ruleset.condition_meters).map(
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

  get trackTypes() {
    return this.campaignContext.trackTypes;
  }
}

export class CharacterActionContext implements IActionContext {
  readonly kind = "character";
  #moves?: StandardIndex<DataswornTypes["move"]>;

  constructor(
    public readonly campaignContext: CampaignDataContext,
    public readonly characterPath: string,
    public readonly characterContext: CharacterContext,
  ) {}

  get oracleRoller(): OracleRoller {
    return this.campaignContext.oracleRoller;
  }

  get rulesPackages() {
    return this.campaignContext.rulesPackages;
  }

  get ruleset(): Ruleset {
    return this.campaignContext.ruleset;
  }

  get assets(): StandardIndex<DataswornTypes["asset"]> {
    return this.campaignContext.assets;
  }

  get moves(): StandardIndex<DataswornTypes["move"]> {
    if (!this.#moves) {
      try {
        const characterMoves = movesReader(
          this.characterContext.lens,
          this,
        ).get(this.characterContext.character);

        this.#moves = this.campaignContext.moves.projected((move) => {
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
      } catch (err) {
        if (err instanceof InvalidCharacterError) {
          console.error(err);
          new Notice(`Invalid character definition: ${err.message}`, 0);
        }
        throw err;
      }
    }
    return this.#moves;
  }

  get moveCategories() {
    return this.campaignContext.moveCategories;
  }

  get oracles() {
    return this.campaignContext.oracles;
  }

  get truths() {
    return this.campaignContext.truths;
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

  get trackTypes() {
    return this.campaignContext.trackTypes;
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
      return await requireActiveCharacterForCampaign(plugin, campaignContext);
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
    return new NoCharacterActionConext(campaignContext);
  }
}

export function formatActionContextDescription(
  actionContext: ActionContext,
): string {
  const campaign = actionContext.campaignContext.campaign;
  const character = actionContext.getWithLens((_) => _.name);
  return `${character != null ? `for '${character}' ` : ""}in '${campaign.name}'`;
}
