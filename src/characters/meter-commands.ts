import { updatePreviousMoveOrCreateBlock } from "mechanics/editor";
import { App, Editor } from "obsidian";
import { ConditionMeterDefinition } from "rules/ruleset";
import { node } from "utils/kdl";
import { updating } from "utils/lens";
import { numberRange } from "utils/numbers";
import { vaultProcess } from "utils/obsidian";
import { CustomSuggestModal } from "utils/suggest";
import IronVaultPlugin from "../index";
import {
  ActionContext,
  CharacterActionContext,
  determineCharacterActionContext,
  requireActiveCharacterContext,
} from "./action-context";
import { MeterWithLens, MeterWithoutLens, momentumOps } from "./lens";

export async function burnMomentum(
  plugin: IronVaultPlugin,
  editor: Editor,
): Promise<void> {
  const actionContext = await requireActiveCharacterContext(plugin);
  const [path, charContext] = [
    actionContext.characterPath,
    actionContext.characterContext,
  ];
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
  }
}

export async function promptForMeter(
  app: App,
  actionContext: ActionContext,
  meterFilter: (
    meter:
      | MeterWithLens<ConditionMeterDefinition>
      | MeterWithoutLens<ConditionMeterDefinition>,
  ) => boolean,
): Promise<
  | MeterWithLens<ConditionMeterDefinition>
  | MeterWithoutLens<ConditionMeterDefinition>
> {
  const { value: meter } = await CustomSuggestModal.selectWithUserEntry(
    app,
    actionContext.conditionMeters.filter(meterFilter),
    ({ definition }) => definition.label,
    (input, el) => {
      el.setText(`Use custom meter '${input}'`);
    },
    (match, el) => {
      el.createEl("small", { text: `${match.item.value}` });
    },
    "Choose a meter",
    (input): MeterWithoutLens<ConditionMeterDefinition> => ({
      key: input,
      lens: undefined,
      value: undefined,
      definition: {
        kind: "condition_meter",
        label: input,
        min: -10,
        max: 10,
        rollable: true,
      },
    }),
  );
  return meter;
}

export const modifyMeterCommand = async (
  plugin: IronVaultPlugin,
  editor: Editor,
  verb: string,
  meterFilter: (
    meter:
      | MeterWithLens<ConditionMeterDefinition>
      | MeterWithoutLens<ConditionMeterDefinition>,
  ) => boolean,
  allowableValues: (
    // This is a meter with a defined value but possibly no lens
    measure: Omit<MeterWithLens<ConditionMeterDefinition>, "lens">,
  ) => number[],
) => {
  // todo: multichar
  const actionContext = await determineCharacterActionContext(plugin);
  if (!actionContext) {
    return;
  }

  const choice = await promptForMeter(plugin.app, actionContext, meterFilter);

  let measure:
    | MeterWithLens<ConditionMeterDefinition>
    | (Omit<MeterWithoutLens<ConditionMeterDefinition>, "value"> & {
        value: number;
      });
  if (!choice.value) {
    const value = await CustomSuggestModal.select(
      plugin.app,
      numberRange(choice.definition.min, choice.definition.max),
      (n) => n.toString(10),
      undefined,
      `What is the starting value of ${choice.definition.label}?`,
    );
    measure = { ...choice, value };
  } else {
    measure = choice;
  }

  const modifier = await CustomSuggestModal.select(
    plugin.app,
    allowableValues(measure),
    (n) => n.toString(),
    undefined,
    `Choose the amount to ${verb} on the '${measure.definition.label}' meter.`,
  );

  let newValue: number;
  if (actionContext instanceof CharacterActionContext && measure.lens) {
    const updated = await actionContext.update(
      plugin.app,
      updating(measure.lens, (startVal) => startVal + modifier),
    );
    newValue = measure.lens.get(updated);
  } else {
    newValue = measure.value + modifier;
  }

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
};
