import { Move } from "@datasworn/core";
import { CharacterContext } from "../character-tracker";
import { movesReader, rollablesReader } from "../characters/lens";
import { type Datastore } from "../datastore";
import ForgedPlugin from "../index";
import { MeterCommon } from "../rules/ruleset";
import { InfoModal } from "../utils/ui/info";

export interface ActionContext {
  readonly moves: Move[];
  readonly rollables: {
    key: string;
    value?: number | undefined;
    definition: MeterCommon;
  }[];
  readonly momentum?: number;
}

export class NoCharacterActionConext implements ActionContext {
  constructor(public readonly datastore: Datastore) {}

  get moves(): Move[] {
    return this.datastore.moves;
  }

  get rollables(): {
    key: string;
    value?: number | undefined;
    definition: MeterCommon;
  }[] {
    return Object.entries(this.datastore.ruleset.stats).map(([key, stat]) => ({
      key,
      definition: stat,
    }));
  }

  get momentum() {
    return undefined;
  }
}

export class CharacterActionContext implements ActionContext {
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

  get rollables(): { key: string; value?: number; definition: MeterCommon }[] {
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
}
export async function determineCharacterActionContext(
  plugin: ForgedPlugin,
): Promise<ActionContext | undefined> {
  if (plugin.settings.useCharacterSystem) {
    try {
      const [characterPath, characterContext] =
        plugin.characters.activeCharacter();
      return new CharacterActionContext(
        plugin.datastore,
        characterPath,
        characterContext,
      );
    } catch (e) {
      // TODO: probably want to show character parse errors in full glory
      await InfoModal.show(
        plugin.app,
        `An error occurred while finding your active character.\n\n${e}`,
      );
      return undefined;
    }
  } else {
    return new NoCharacterActionConext(plugin.datastore);
  }
}
