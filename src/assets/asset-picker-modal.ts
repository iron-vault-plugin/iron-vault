import { Asset } from "@datasworn/core/dist/Datasworn";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import MiniSearch from "minisearch";
import { App, Modal } from "obsidian";
import renderAssetCard from "./asset-card";

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
    const { sources, total } = this.getAssetCategories(filter);
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
      <ul class="iron-vault-asset-list">
        ${map(Object.entries(sources), ([sourceName, source]) =>
          this.renderSource(sourceName, source, total <= 5),
        )}
      </ul>
    `;
    render(tpl, this.contentEl);
  }

  renderSource(
    sourceName: string,
    source: Record<string, { color?: string; assets: Asset[] }>,
    open: boolean,
  ) {
    return html`
      <li class="ruleset">
        <div class="wrapper">
          <details open>
            <summary>
              <span>${sourceName}</span>
            </summary>
          </details>
          <ul class="content categories">
            ${map(Object.entries(source), ([catName, category]) =>
              this.renderCategory(catName, category, open),
            )}
          </ul>
        </div>
      </li>
    `;
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
          <ul class="content category">
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
          </ul>
        </div>
      </li>
    `;
  }

  getAssetCategories(filter?: string): {
    sources: Record<
      string,
      Record<string, { color?: string; assets: Asset[] }>
    >;
    total: number;
  } {
    const sources: Record<
      string,
      Record<string, { color?: string; assets: Asset[] }>
    > = {};
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

      const source = sources[asset._source.title] ?? {};
      sources[asset._source.title] = source;
      const category = source[asset.category] ?? {
        color: asset.color,
        assets: [],
      };
      category.assets.push(asset);
      source[asset.category] = category;
      total += 1;
    }
    return { sources, total };
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
