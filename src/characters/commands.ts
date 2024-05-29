import { type Datasworn } from "@datasworn/core";
import { produce } from "immer";
import IronVaultPlugin from "index";
import { Editor, FuzzyMatch, MarkdownView, stringifyYaml } from "obsidian";
import { vaultProcess } from "utils/obsidian";
import { firstUppercase } from "utils/strings";
import { CustomSuggestModal } from "utils/suggest";
import { PromptModal } from "utils/ui/prompt";
import { PLUGIN_KIND_FIELD, pluginPrefixed } from "../constants";
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

export async function addAssetToCharacter(
  plugin: IronVaultPlugin,
  _editor: Editor,
  _view: MarkdownView,
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
          firstUppercase(optionField.label),
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
          firstUppercase(optionField.label),
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

export async function createNewCharacter({ app, datastore }: IronVaultPlugin) {
  const { lens, validater } = characterLens(datastore.ruleset);
  const name = await PromptModal.prompt(
    app,
    "What is the name of the character?",
  );

  const charactersFolder = app.vault.getFolderByPath("characters");
  if (!charactersFolder) return;

  const file = await app.fileManager.createNewMarkdownFile(
    charactersFolder,
    name,
    `---\n${stringifyYaml({ ...createValidCharacter(lens, validater, name).raw, [PLUGIN_KIND_FIELD]: "character" })}\n---\n\n`,
  );

  await app.workspace.getLeaf().openFile(file, {
    active: true,
    state: { mode: "source" },
    eState: { rename: "all" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templaterPlugin: any = (app.plugins.plugins as Record<string, any>)[
    "templater-obsidian"
  ];
  const templateFile = undefined; //app.vault.getFileByPath("Templates/Character.md");
  if (templaterPlugin && templateFile) {
    await templaterPlugin.templater.append_template_to_active_file(
      templateFile,
    );
  } else {
    await app.vault.append(
      file,
      `\n\`\`\`${pluginPrefixed("character")}\n\`\`\`\n`,
    );
  }
}
