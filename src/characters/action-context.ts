import { type Datasworn } from "@datasworn/core";
import { App } from "obsidian";
import { ConditionMeterDefinition } from "rules/ruleset";
import { vaultProcess } from "utils/obsidian";
import { CharacterContext, activeCharacter } from "../character-tracker";
import {
  CharReader,
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

export interface IActionContext {
  readonly kind: "no_character" | "character";
  readonly moves: Datasworn.Move[];
  readonly rollables: (MeterWithLens | MeterWithoutLens)[];
  readonly conditionMeters: (
    | MeterWithLens<ConditionMeterDefinition>
    | MeterWithoutLens<ConditionMeterDefinition>
  )[];

  readonly momentum?: number;

  getWithLens<T>(lens: CharReader<T>): T | undefined;
}

export class NoCharacterActionConext implements IActionContext {
  readonly kind = "no_character";
  readonly momentum: undefined = undefined;

  constructor(public readonly datastore: Datastore) {}

  get moves(): Datasworn.Move[] {
    return this.datastore.moves;
  }

  get rollables(): MeterWithoutLens[] {
    return Object.entries(this.datastore.ruleset.stats).map(([key, stat]) => ({
      key,
      definition: stat,
      lens: undefined,
      value: undefined,
    }));
  }

  getWithLens<T>(_lens: CharReader<T>): undefined {
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

  constructor(
    public readonly datastore: Datastore,
    public readonly characterPath: string,
    public readonly characterContext: CharacterContext,
  ) {}

  get moves() {
    const characterMoves = movesReader(
      this.characterContext.lens,
      this.datastore.index,
    )
      .get(this.characterContext.character)
      .expect("unexpected failure finding assets for moves");

    return this.datastore.moves.concat(characterMoves);
  }

  get rollables(): MeterWithLens[] {
    return rollablesReader(
      this.characterContext.lens,
      this.datastore.index,
    ).get(this.characterContext.character);
  }

  get momentum() {
    return this.characterContext.lens.momentum.get(
      this.characterContext.character,
    );
  }

  getWithLens<T>(lens: CharReader<T>): T {
    return lens.get(this.characterContext.character);
  }

  get conditionMeters(): MeterWithLens<ConditionMeterDefinition>[] {
    const { character, lens } = this.characterContext;
    return Object.values(
      meterLenses(lens, character, this.datastore.index),
    ).map(({ key, definition, lens }) => ({
      key,
      definition,
      lens,
      value: lens.get(character),
    }));
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

export async function requireActiveCharacterContext(
  plugin: IronVaultPlugin,
): Promise<CharacterActionContext> {
  const context = await determineCharacterActionContext(plugin);
  if (!context || !(context instanceof CharacterActionContext)) {
    await InfoModal.show(
      plugin.app,
      "Command requires an active character, but none was found.",
    );
    throw new Error(
      "Command requires an active character, but none was found.",
    );
  }

  return context;
}

export async function determineCharacterActionContext(
  plugin: IronVaultPlugin,
): Promise<ActionContext | undefined> {
  if (plugin.settings.useCharacterSystem) {
    try {
      const [characterPath, characterContext] = activeCharacter(
        plugin.characters,
      );
      return new CharacterActionContext(
        plugin.datastore,
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
      // TODO: maybe this should just raise an exception because the alternative is boring.
      return undefined;
    }
  } else {
    return new NoCharacterActionConext(plugin.datastore);
  }
}
