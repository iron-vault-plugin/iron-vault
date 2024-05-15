import { updatePreviousMoveOrCreateBlock } from "mechanics/editor";
import { Editor } from "obsidian";
import { ConditionMeterDefinition } from "rules/ruleset";
import { MoveBlockFormat } from "settings";
import { node } from "utils/kdl";
import { updating } from "utils/lens";
import { vaultProcess } from "utils/obsidian";
import { CustomSuggestModal } from "utils/suggest";
import ForgedPlugin from "../index";
import { meterLenses, momentumOps } from "./lens";

export async function burnMomentum(
  plugin: ForgedPlugin,
  editor: Editor,
): Promise<void> {
  const [path, charContext] = plugin.characters.activeCharacter();
  const { lens, character } = charContext;
  const oldValue = lens.momentum.get(character);
  if (oldValue > 0) {
    // TODO: is the move here to straight-up throw an error if there isn't enough momentum?
    const updated = await charContext.updater(
      vaultProcess(plugin.app, path),
      (character, { lens }) => {
        return momentumOps(lens).reset(character);
      },
    );
    if (plugin.settings.moveBlockFormat == MoveBlockFormat.Mechanics) {
      const newValue = lens.momentum.get(updated);
      const burnNode = node("burn", {
        properties: { from: oldValue, to: newValue },
      });
      updatePreviousMoveOrCreateBlock(
        editor,
        (move) => {
          return {
            ...move,
            children: [...move.children, burnNode],
          };
        },
        () => burnNode,
      );
    } else {
      const template = Handlebars.compile(
        plugin.settings.momentumResetTemplate,
        {
          noEscape: true,
        },
      );
      editor.replaceSelection(
        template({
          character: { name: lens.name.get(updated) },
          oldValue,
          newValue: lens.momentum.get(updated),
        }),
      );
    }
  }
}

export const modifyMeterCommand = async (
  plugin: ForgedPlugin,
  editor: Editor,
  verb: string,
  meterFilter: (meter: {
    value: number;
    definition: ConditionMeterDefinition;
  }) => boolean,
  allowableValues: (measure: {
    value: number;
    definition: ConditionMeterDefinition;
  }) => number[],
) => {
  // todo: multichar
  const [path, context] = plugin.characters.activeCharacter();
  const { character, lens } = context;
  const measure = await CustomSuggestModal.select(
    plugin.app,
    Object.values(meterLenses(lens, character, plugin.datastore.index))
      .map(({ key, definition, lens }) => ({
        key,
        definition,
        lens,
        value: lens.get(character),
      }))
      .filter(meterFilter),
    ({ definition }) => definition.label,
    (match, el) => {
      el.createEl("small", { text: `${match.item.value}` });
    },
  );
  const modifier = await CustomSuggestModal.select(
    plugin.app,
    allowableValues(measure),
    (n) => n.toString(),
    undefined,
    `${verb} ${measure.definition.label}`,
  );
  const updated = await context.updater(
    vaultProcess(plugin.app, path),
    (character) => {
      return updating(
        measure.lens,
        (startVal) => startVal + modifier,
      )(character);
    },
  );
  if (plugin.settings.moveBlockFormat == MoveBlockFormat.Mechanics) {
    const newValue = measure.lens.get(updated);
    const meterNode = node("meter", {
      values: [measure.key],
      properties: { from: measure.value, to: newValue },
    });
    updatePreviousMoveOrCreateBlock(
      editor,
      (move) => {
        return {
          ...move,
          children: [...move.children, meterNode],
        };
      },
      () => meterNode,
    );
  } else {
    const template = Handlebars.compile(plugin.settings.meterAdjTemplate, {
      noEscape: true,
    });
    editor.replaceSelection(
      template({
        character: { name: lens.name.get(character) },
        measure,
        newValue: measure.lens.get(updated),
      }),
    );
  }
};
