import { type Datasworn } from "@datasworn/core";
import { Asset } from "@datasworn/core/dist/Datasworn";
import { AssetPickerModal } from "assets/asset-picker-modal";
import { produce } from "immer";
import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlockWithActor } from "mechanics/editor";
import { createInitiativeNode } from "mechanics/node-builders";
import { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";
import { Ruleset } from "rules/ruleset";
import { createNewIronVaultEntityFile, vaultProcess } from "utils/obsidian";
import { capitalize } from "utils/strings";
import { CustomSuggestModal } from "utils/suggest";
import { PromptModal } from "utils/ui/prompt";
import { IronVaultKind, pluginPrefixed } from "../constants";
import {
  CharacterActionContext,
  requireActiveCharacterContext,
} from "./action-context";
import {
  addOrUpdateViaDataswornAsset,
  defaultMarkedAbilitiesForAsset,
  walkAsset,
} from "./assets";
import { characterLens, createValidCharacter } from "./lens";

export async function addAssetToCharacter(
  plugin: IronVaultPlugin,
  _editor?: Editor,
  view?: MarkdownView,
  asset?: Asset,
  charCtx?: CharacterActionContext,
): Promise<void> {
  // TODO: maybe we could make this part of the checkCallback? (i.e., if we are in no character
  // mode, don't even bother to list this command?)
  const actionContext =
    charCtx || (await requireActiveCharacterContext(plugin, view));

  const path = actionContext.characterPath;
  const context = actionContext.characterContext;
  const { character, lens } = context;
  const characterAssets = lens.assets.get(character);

  const availableAssets: Datasworn.Asset[] = [];
  for (const asset of plugin.datastore.assets.values()) {
    if (!characterAssets.find(({ id }) => id === asset._id)) {
      // Character does not have this asset
      availableAssets.push(asset);
    }
  }

  const selectedAsset =
    asset ?? (await AssetPickerModal.pick(plugin, actionContext));

  if (!selectedAsset) {
    return;
  }

  const options: [string, Datasworn.AssetOptionField][] = [];
  walkAsset(
    selectedAsset,
    {
      onAnyOption(key, option) {
        options.push([key, option]);
      },
    },
    defaultMarkedAbilitiesForAsset(selectedAsset),
  );

  const optionValues: Record<string, string> = {};
  for (const [key, optionField] of options) {
    switch (optionField.field_type) {
      case "select_value": {
        const choice = await CustomSuggestModal.select(
          plugin.app,
          Object.entries(optionField.choices),
          ([_choiceKey, choice]) => choice.label,
          undefined,
          capitalize(optionField.label),
        );
        optionValues[key] = choice[0];
        break;
      }
      case "select_enhancement": {
        alert(
          "'select_enhancement' option type is not supported at this time.",
        );
        continue;
      }
      case "text": {
        optionValues[key] = await PromptModal.prompt(
          plugin.app,
          capitalize(optionField.label),
        );
      }
    }
  }

  // TODO: this is clunky-- at this point, optionValues is actually just the options field
  // in the IronVaultAssetSchema... so can't we just work with that?
  const updatedAsset = produce(selectedAsset, (draft) => {
    walkAsset(
      draft,
      {
        onAnyOption(key, option) {
          option.value = optionValues[key];
        },
      },
      defaultMarkedAbilitiesForAsset(selectedAsset),
    );
  });

  await context.updater(vaultProcess(plugin.app, path), (char) =>
    addOrUpdateViaDataswornAsset(lens, plugin.datastore).update(
      char,
      updatedAsset,
    ),
  );
}

export async function createNewCharacter(plugin: IronVaultPlugin) {
  const { lens, validater } = characterLens(plugin.datastore.ruleset);
  const name = await PromptModal.prompt(
    plugin.app,
    "What is the name of the character?",
  );

  await createNewIronVaultEntityFile(
    plugin.app,
    plugin.settings.defaultCharactersFolder,
    name,
    IronVaultKind.Character,
    createValidCharacter(lens, validater, name).raw,
    plugin.settings.characterTemplateFile,
    `
\`\`\`${pluginPrefixed("character-info")}
\`\`\`

\`\`\`${pluginPrefixed("character-stats")}
\`\`\`

\`\`\`${pluginPrefixed("character-meters")}
\`\`\`

\`\`\`${pluginPrefixed("character-special-tracks")}
\`\`\`

\`\`\`${pluginPrefixed("character-impacts")}
\`\`\`

\`\`\`${pluginPrefixed("character-assets")}
\`\`\`

`,
    true,
  );
}

export function initiativeValueLabel(
  ruleset: Ruleset,
  val: boolean | undefined,
): string {
  const labels = [];
  if (val === true && ruleset.ids.contains("classic")) {
    labels.push("Has initiative");
  }
  if (val === false && ruleset.ids.contains("classic")) {
    labels.push("No initiative");
  }
  if (val === true && ruleset.ids.contains("starforged")) {
    labels.push("In control");
  }
  if (val === false && ruleset.ids.contains("starforged")) {
    labels.push("In a bad spot");
  }
  if (val == null) {
    labels.push("Out of combat");
  }
  return labels.join("/");
}

export const changeInitiative = async (
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
) => {
  const actionContext = await requireActiveCharacterContext(plugin, view);

  const ruleset = actionContext.datastore.ruleset;

  const { character, lens } = actionContext.characterContext;

  const oldInitiative = lens.initiative.get(character);

  const newInitiative = await CustomSuggestModal.select(
    plugin.app,
    [true, false, undefined],
    (n) => initiativeValueLabel(ruleset, n),
    undefined,
    `Choose the new value for your initiative/position.`,
  );

  await actionContext.update(plugin.app, (char, { lens }) =>
    lens.initiative.update(char, newInitiative),
  );

  appendNodesToMoveOrMechanicsBlockWithActor(
    editor,
    plugin,
    actionContext,
    createInitiativeNode(
      // TODO(@cwegrzyn): once we have a setting that controls which version of position/initiative
      //   to use, we'll use that instead here and in determining the label.
      ruleset.ids.contains("starforged") ? "position" : "initiative",
      initiativeValueLabel(ruleset, oldInitiative).toLowerCase(),
      initiativeValueLabel(ruleset, newInitiative).toLowerCase(),
    ),
  );
};
