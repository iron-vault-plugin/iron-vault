import { type Datasworn } from "@datasworn/core";
import { produce } from "immer";
import IronVaultPlugin from "index";
import { App, Editor, MarkdownView, Modal } from "obsidian";
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
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import MiniSearch from "minisearch";
import renderAssetCard from "./asset-card";

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

  const selectedAsset = asset ?? (await AssetPickerModal.pick(plugin));

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
    `\n\`\`\`${pluginPrefixed("character")}\n\`\`\`\n`,
    true,
  );
}

export class AssetPickerModal extends Modal {
  plugin: IronVaultPlugin;
  searchIdx: MiniSearch<Asset>;

  static pick(plugin: IronVaultPlugin) {
    return new Promise<Asset | undefined>((resolve, reject) => {
      const modal = new AssetPickerModal(
        plugin.app,
        plugin,
        (asset) => {
          modal.close();
          resolve(asset);
        },
        () => {
          modal.close();
          reject();
        },
      );
      modal.open();
    });
  }

  constructor(
    app: App,
    plugin: IronVaultPlugin,
    protected readonly onSelect: (asset: Asset) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
    this.plugin = plugin;
    this.searchIdx = this.makeIndex();
  }

  onOpen() {
    this.setTitle("Add Asset to Character");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.toggleClass("iron-vault-modal-content", true);
    this.render();
  }

  render(filter?: string) {
    const { categories, total } = this.getAssetCategories(filter);
    const tpl = html`
      <input
        class="search-box"
        type="search"
        placeholder="Filter assets..."
        @input=${(e: Event) => {
          const input = e.target as HTMLInputElement;
          this.render(input.value);
        }}
      />
      <ol class="iron-vault-asset-list">
        ${map(Object.entries(categories), ([catName, category]) =>
          this.renderCategory(catName, category, total <= 5),
        )}
      </ol>
    `;
    render(tpl, this.contentEl);
  }

  renderCategory(
    catName: string,
    category: { color?: string; assets: Asset[] },
    open: boolean,
  ) {
    return html`
      <li
        class="category"
        style=${category.color
          ? `border-left: 6px solid ${category.color}`
          : ""}
      >
        <div class="wrapper">
          <details ?open=${open}>
            <summary>
              <span>${catName}</span>
            </summary>
          </details>
          <ol class="content category">
            ${map(
              category.assets,
              (asset) =>
                html`<div class="wrapper">
                  <details ?open=${open}>
                    <summary>
                      <span>${asset.name}</span>
                    </summary>
                  </details>
                  <div class="content asset">
                    <button type="button" @click=${() => this.onSelect(asset)}>
                      Add this Asset
                    </button>
                    ${renderAssetCard(this.plugin, {
                      id: asset._id,
                      abilities: [true, false, false],
                      options: {},
                      controls: {},
                    })}
                  </div>
                </div>`,
            )}
          </ol>
        </div>
      </li>
    `;
  }

  getAssetCategories(filter?: string): {
    categories: Record<string, { color?: string; assets: Asset[] }>;
    total: number;
  } {
    const categories: Record<string, { color?: string; assets: Asset[] }> = {};
    const results = filter
      ? this.searchIdx.search(filter)
      : [...this.plugin.datastore.assets.values()].map((m) => ({ id: m._id }));
    let total = 0;
    for (const res of results) {
      const asset = this.plugin.datastore.assets.get(res.id)!;
      if (!asset) {
        console.error("couldn't find asset for", res);
        continue;
      }
      const category = categories[asset.category] ?? {
        color: asset.color,
        assets: [],
      };
      category.assets.push(asset);
      categories[asset.category] = category;
      total += 1;
    }
    return { categories, total };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  makeIndex() {
    const idx = new MiniSearch({
      fields: ["name", "category"],
      idField: "_id",
      searchOptions: {
        prefix: true,
        fuzzy: 0.3,
        boost: { name: 2 },
      },
    });
    // TODO: use the current context
    idx.addAll([...this.plugin.datastore.assets.values()]);
    return idx;
  }
}
