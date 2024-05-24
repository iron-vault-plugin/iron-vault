import { type Datasworn } from "@datasworn/core";
import IronVaultPlugin from "index";
import { Editor, FuzzyMatch, MarkdownView } from "obsidian";
import { vaultProcess } from "utils/obsidian";
import { firstUppercase } from "utils/strings";
import { CustomSuggestModal } from "utils/suggest";
import { PromptModal } from "utils/ui/prompt";
import {
  addAsset,
  defaultMarkedAbilitiesForAsset,
  getPathLabel,
  traverseAssetOptions,
  updateAssetWithOptions,
} from "./assets";

export async function addAssetToCharacter(
  plugin: IronVaultPlugin,
  _editor: Editor,
  _view: MarkdownView,
): Promise<void> {
  const [path, context] = plugin.characters.activeCharacter();
  const { character, lens } = context;
  const characterAssets = lens.assets.get(character);

  const availableAssets: Datasworn.Asset[] = [];
  for (const asset of plugin.datastore.assets.values()) {
    if (!characterAssets.find(({ id }) => id === asset._id)) {
      // Character does not have this asset
      availableAssets.push(asset);
    }
  }

  const selectedAsset = await CustomSuggestModal.select(
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
  );

  const options = traverseAssetOptions(
    selectedAsset,
    defaultMarkedAbilitiesForAsset(selectedAsset),
  );
  const optionValues: Record<string, string> = {};
  for (const pathed of options) {
    const { value: optionControl } = pathed;
    let value: string;
    switch (optionControl.field_type) {
      case "select_value": {
        const choice = await CustomSuggestModal.select(
          plugin.app,
          Object.entries(optionControl.choices),
          ([_choiceKey, choice]) => choice.label,
          undefined,
          firstUppercase(optionControl.label),
        );
        value = choice[0];
        break;
      }
      case "select_enhancement": {
        alert(
          "'select_enhancement' option type is not supported at this time.",
        );
        continue;
      }
      case "text": {
        value = await PromptModal.prompt(
          plugin.app,
          firstUppercase(optionControl.label),
        );
      }
    }
    optionValues[getPathLabel(pathed)] = value;
  }

  const updatedAsset = updateAssetWithOptions(selectedAsset, optionValues);

  await context.updater(
    vaultProcess(plugin.app, path),
    (character, context) => {
      return addAsset(context.lens).update(character, updatedAsset);
    },
  );
}
