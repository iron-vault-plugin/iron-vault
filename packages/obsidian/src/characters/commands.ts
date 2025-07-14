import { type Datasworn } from "@datasworn/core";
import { Asset } from "@datasworn/core/dist/Datasworn";
import { AssetPickerModal } from "assets/asset-picker-modal";
import { CampaignDataContext } from "campaigns/context";
import { determineCampaignContext } from "campaigns/manager";
import {
  promptForCampaignCharacter,
  setActiveCharacter,
} from "character-tracker";
import { produce } from "immer";
import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlockWithActor } from "mechanics/editor";
import { createInitiativeNode } from "mechanics/node-builders";
import { Editor, MarkdownFileInfo, MarkdownView, Notice } from "obsidian";
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
import {
  labelForCharacterInitiative,
  labelForCharacterInitiativeValue,
} from "./character-block";
import { characterLens, createValidCharacter } from "./lens";
import { CharacterCreateModal } from "./ui/new-character-modal";

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
  for (const asset of actionContext.assets.values()) {
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
    addOrUpdateViaDataswornAsset(lens).update(char, updatedAsset),
  );
}

export async function createNewCharacter(
  plugin: IronVaultPlugin,
  campaignContext: CampaignDataContext,
  defaultFolder?: string,
) {
  const { lens, validater } = characterLens(campaignContext.ruleset);

  const { fileName, name, targetFolder } = await CharacterCreateModal.show(
    plugin,
    {
      targetFolder: defaultFolder,
    },
  );

  const newChar = createValidCharacter(lens, validater, name).unwrapOrElse(
    (err) => {
      new Notice(`Error creating character: ${err.message}`);
      throw err;
    },
  );

  await createNewIronVaultEntityFile(
    plugin.app,
    targetFolder,
    fileName,
    IronVaultKind.Character,
    newChar.raw,
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

export const changeInitiative = async (
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
) => {
  const actionContext = await requireActiveCharacterContext(plugin, view);

  const ruleset = actionContext.ruleset;

  const { character, lens } = actionContext.characterContext;

  const oldInitiative = lens.initiative.get(character);

  const newInitiative = await CustomSuggestModal.select(
    plugin.app,
    [true, false, undefined],
    (n) => labelForCharacterInitiativeValue(ruleset, n),
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
      labelForCharacterInitiative(ruleset),
      labelForCharacterInitiativeValue(ruleset, oldInitiative).toLowerCase(),
      labelForCharacterInitiativeValue(ruleset, newInitiative).toLowerCase(),
    ),
  );
};
export async function pickActiveCharacter(
  plugin: IronVaultPlugin,
  view?: MarkdownView | MarkdownFileInfo,
) {
  const campaignContext = await determineCampaignContext(plugin, view);
  const actionContext = await promptForCampaignCharacter(
    plugin,
    campaignContext,
  );
  await setActiveCharacter(
    plugin,
    campaignContext.campaign,
    actionContext.characterPath,
  );
}
