import { type Datasworn } from "@datasworn/core";
import { produce } from "immer";
import IronVaultPlugin from "index";
import { Editor, FuzzyMatch, MarkdownView } from "obsidian";
import { createNewIronVaultEntityFile, vaultProcess } from "utils/obsidian";
import { capitalize } from "utils/strings";
import { CustomSuggestModal } from "utils/suggest";
import { PromptModal } from "utils/ui/prompt";
import { IronVaultKind, pluginPrefixed } from "../constants";
import {
  NoCharacterActionConext as NoCharacterActionContext,
  determineCharacterActionContext,
} from "./action-context";
import {
  addOrUpdateViaDataswornAsset,
  defaultMarkedAbilitiesForAsset,
  walkAsset,
} from "./assets";
import { characterLens, createValidCharacter } from "./lens";
import { Asset } from "@datasworn/core/dist/Datasworn";

export async function addAssetToCharacter(
  plugin: IronVaultPlugin,
  _editor?: Editor,
  _view?: MarkdownView,
  asset?: Asset,
): Promise<void> {
  const actionContext = await determineCharacterActionContext(plugin);
  // TODO: maybe we could make this part of the checkCallback? (i.e., if we are in no character
  // mode, don't even bother to list this command?)
  if (!actionContext || actionContext instanceof NoCharacterActionContext) {
    return;
  }
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
    asset ??
    (await CustomSuggestModal.select(
      plugin.app,
      availableAssets,
      (asset) => asset.name,
      ({ item: asset }: FuzzyMatch<Datasworn.Asset>, el: HTMLElement) => {
        el.createEl("small", {
          text:
            asset.category +
            (asset.requirement ? ` (requirement: ${asset.requirement})` : ""),
          cls: "iron-vault-suggest-hint",
        });
      },
      `Choose an asset to add to character ${lens.name.get(character)}.`,
    ));

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
    `\n\`\`\`${pluginPrefixed("character")}\n\`\`\`\n`,
    true,
  );
}
