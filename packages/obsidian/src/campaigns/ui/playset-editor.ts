import { PlaysetAwareDataContext } from "campaigns/context";
import { PlaysetConfig } from "campaigns/playsets/config";
import {
  getStandardPlaysetDefinition,
  STANDARD_PLAYSET_DEFNS,
} from "campaigns/playsets/standard";
import { DataswornIndexer } from "datastore/datasworn-indexer";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import MiniSearch from "minisearch";
import {
  App,
  ButtonComponent,
  debounce,
  DropdownComponent,
  Modal,
  setIcon,
  Setting,
} from "obsidian";
import { DataSuggest, highlightTerms } from "./data-suggest";

function createSearchIndex(
  baseData: DataswornIndexer,
): MiniSearch<{ _id: string; name?: string; kind: string; source: string }> {
  const index = new MiniSearch({
    fields: ["_id", "name", "kind", "source"],
    storeFields: ["name", "kind", "source"],
    idField: "_id",
    searchOptions: {
      prefix: true,
      fuzzy: 0.3,
    },
  });

  for (const [_id, item] of baseData.prioritized.entries() ?? []) {
    index.add({
      _id,
      kind: item.kind,
      name: (item.value as { name?: string }).name,
      source: item.source.path,
    });
  }

  return index;
}

export class PlaysetEditor extends Modal {
  currentPlaysetChoice: string = "";
  customConfig: string = "";
  currentSearch: string = "";
  resultSetting: Setting;
  playsetDataContext?: PlaysetAwareDataContext;
  dataSuggest!: DataSuggest;
  #index: MiniSearch<{
    _id: string;
    name?: string;
    kind: string;
    source: string;
  }>;
  searchResultsEl: HTMLDivElement;
  configEditorEl: HTMLTextAreaElement;
  okButton!: ButtonComponent;

  static open(
    app: App,
    baseData: DataswornIndexer,
    initialPlaysetChoice?: string,
    initialCustomConfig?: string,
  ): Promise<{ playset: string; customConfig: string }> {
    return new Promise((resolve, reject) => {
      try {
        const modal = new this(
          app,
          baseData,
          resolve,
          reject,
          initialPlaysetChoice,
          initialCustomConfig,
        );
        modal.open();
      } catch (e) {
        reject(e);
      }
    });
  }

  static playsetOptions(includeKey: boolean = false): Record<string, string> {
    return {
      ...Object.fromEntries(
        Object.entries(STANDARD_PLAYSET_DEFNS).map(([key, { name }]) => [
          key,
          name + (includeKey ? ` (key: ${key})` : ""),
        ]),
      ),
      custom: "Custom playset",
    };
  }

  constructor(
    app: App,
    readonly baseData: DataswornIndexer,
    readonly onAccept: (result: {
      playset: string;
      customConfig: string;
    }) => void,
    readonly onCancel: () => void,
    readonly initialPlaysetChoice?: string,
    readonly initialCustomConfig: string = "",
  ) {
    super(app);
    this.setTitle("Choose playset");

    this.#index = createSearchIndex(baseData);
    this.currentPlaysetChoice = initialPlaysetChoice ?? "starforged";
    this.customConfig = initialCustomConfig;

    const refresh = debounce(() => this.refresh(), 200, true);

    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "Configure the playset for your campaign by choosing an existing playset config or creating a custom one.",
    });

    let playsetDropdown!: DropdownComponent;
    new Setting(this.contentEl).setName("Playset").addDropdown((dropdown) =>
      (playsetDropdown = dropdown)
        .addOptions(PlaysetEditor.playsetOptions(true))
        .setValue(this.currentPlaysetChoice)
        .onChange((playsetChoice) => {
          this.currentPlaysetChoice = playsetChoice;
          // Make the editor reflect this config
          if (this.currentPlaysetChoice == "custom") {
            this.configEditorEl.value = this.customConfig;
            this.configEditorEl.disabled = false;
          } else {
            this.configEditorEl.value =
              getStandardPlaysetDefinition(playsetChoice)!.lines.join("\n");
            this.configEditorEl.disabled = true;
          }
          this.refresh();
        }),
    );

    this.configEditorEl = this.contentEl.createEl(
      "textarea",
      { cls: "iv-modal-text-area" },
      (el) => {
        el.spellcheck = false;
        el.addEventListener("input", () => {
          this.customConfig = el.value;
          refresh();
        });
      },
    );

    this.resultSetting = new Setting(this.contentEl);

    new Setting(this.contentEl)
      .setName("Search")
      .setDesc(
        "Use this to search through content to determine if it is included in your config",
      )
      .addSearch((search) => {
        search.onChange((query) => {
          this.currentSearch = query;
          this.updateList();
        });
      });

    this.searchResultsEl = this.contentEl.createDiv({
      cls: "iv-modal-suggestion-list",
    });

    new Setting(this.contentEl)
      .addButton((ok) =>
        (this.okButton = ok)
          .setCta()
          .setButtonText("Select")
          .onClick(() => {
            this.onAccept({
              playset: this.currentPlaysetChoice,
              customConfig: this.customConfig,
            });
            this.close();
          }),
      )
      .addButton((cancel) =>
        cancel.setButtonText("Cancel").onClick(() => this.close()),
      );

    playsetDropdown.selectEl.trigger("change");
  }

  private refresh(): void {
    let playset: PlaysetConfig | undefined = undefined;
    try {
      playset = PlaysetConfig.parseFile(this.configEditorEl.value);
      this.resultSetting.setDesc("");
      this.okButton.setDisabled(false);
    } catch (e) {
      this.resultSetting.setDesc(`Error: ${String(e)}`);
      this.okButton.setDisabled(true);
    }

    this.playsetDataContext =
      playset && new PlaysetAwareDataContext(this.baseData, playset);

    this.updateList();
  }

  private updateList() {
    const results =
      this.currentSearch == "" ? [] : this.#index.search(this.currentSearch);
    render(
      html`${map(results.slice(0, 50), (value) => {
        const isIncluded = this.playsetDataContext?.prioritized.has(value.id);
        return html`<div class="suggestion">
          <span
            ><span
              ${ref(
                (el) =>
                  el instanceof HTMLElement &&
                  setIcon(el, isIncluded ? "check" : "x"),
              )}
            ></span
            >${highlightTerms(value.kind, value.queryTerms)}:
            ${highlightTerms(value.name, value.queryTerms)} </span
          ><br />
          <small class="iron-vault-suggest-hint"
            >${highlightTerms(value.id, value.queryTerms)}</small
          >
        </div>`;
      })}`,
      this.searchResultsEl,
    );
  }

  override onClose(): void {
    this.onCancel();
    super.onClose();
  }
}
