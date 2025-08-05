import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { CampaignDataContext } from "campaigns/context";
import { IDataContext } from "datastore/data-context";
import { generateEntityCommand } from "entity/command";
import { ENTITIES } from "entity/specs";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import MiniSearch from "minisearch";
import { Oracle, OracleRulesetGrouping } from "model/oracle";
import { getIcon, MarkdownView, SearchComponent, setIcon } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { OracleModal } from "oracles/oracle-modal";
import {
  CollapseExpandDecorator,
  renderGrouping,
  renderRuleset,
} from "./content-tree";

type OracleViewBehaviors = {
  onClickOracleName: (oracle: Oracle) => void;
  onClickOracleDetails: (oracle: Oracle) => void;
  onClickOracleGroup: (group: CollectionGrouping) => void;
};

export class OracleList extends CampaignDependentBlockRenderer {
  contentEl: HTMLElement;
  index?: MiniSearch<OracleIndexEntry>;
  targetView?: MarkdownView;
  filter: string = "";
  search: SearchComponent;
  collapseExpandDec: CollapseExpandDecorator;

  #behaviors: OracleViewBehaviors;

  constructor(
    containerEl: HTMLElement,
    plugin: IronVaultPlugin,
    sourcePath?: string,
  ) {
    super(containerEl, plugin, sourcePath, {
      watchDataIndex: true,
      debouncePeriod: 100,
    });
    this.contentEl = containerEl.createDiv({
      cls: "iron-vault-oracle-list-container",
    });

    this.search = new SearchComponent(this.contentEl)
      .setPlaceholder("Filter oracles...")
      .onChange((query) => {
        this.filter = query.trim();
        this.render();
      });

    this.collapseExpandDec = new CollapseExpandDecorator(
      this.search,
      "expand-all",
    ).onClick((method) => {
      this.contentEl.querySelectorAll("details").forEach((detailsEl) => {
        // We want to expand all rulesets, and close all other details.
        const shouldExpand =
          method === "expand-all" ||
          (detailsEl.parentElement?.hasClass("ruleset") ?? false);
        detailsEl.open = shouldExpand;
      });
    });

    this.#behaviors = {
      onClickOracleDetails: this.openOracleModal.bind(this),
      onClickOracleName: this.handleOracleRoll.bind(this),
      onClickOracleGroup: this.rollOracleBatch.bind(this),
    };
  }

  updateCollapseExpand(method?: "collapse-all" | "expand-all") {
    if (!method) {
      const openElements = this.contentEl.querySelectorAll(
        "li:not(.ruleset) > details[open]",
      );
      method = openElements.length > 0 ? "collapse-all" : "expand-all";
    }
    this.collapseExpandDec.setMethod(method);
  }

  override onunload() {
    this.contentEl.remove();
    super.onunload();
  }

  protected override onNewContext(
    context: CampaignDataContext | undefined,
  ): void {
    this.index = context && makeIndex(context);
  }

  updateView(view: MarkdownView | undefined) {
    if (view !== this.targetView) {
      this.targetView = view;
      this.triggerUpdate();
    }
  }

  render() {
    const { rulesets, total } = getOracleTree(
      this.dataContext,
      this.index!,
      this.filter,
    );
    render(
      html`
        <ul class="iron-vault-oracles-list">
          ${map(rulesets, (r) =>
            renderRuleset({
              open: true,
              name: r.name,
              children: map(r.children, (group) =>
                renderGroup(this.#behaviors, group, total <= 5, () =>
                  this.updateCollapseExpand(),
                ),
              ),
            }),
          )}
        </ul>
      `,
      this.contentEl,
    );
  }

  override renderWithoutContext(): void | Promise<void> {
    render(
      html`<article class="error">
        This block may only be used within a campaign.
      </article>`,
      this.contentEl,
    );
  }

  rollOracleBatch(group: CollectionGrouping) {
    let entityDefn = Object.values(ENTITIES).find(
      (desc) => desc.collectionId === group.id,
    );
    if (!entityDefn) {
      entityDefn = {
        collectionId: group.id,
        label: group.name,
        spec: Object.fromEntries(
          group.children.map((oracle) => [
            oracle.name,
            {
              id: oracle.id,
              firstLook: false,
            },
          ]),
        ),
      };
    }
    const { workspace } = this.plugin.app;
    const view = workspace.getActiveFileView();
    if (view && view instanceof MarkdownView) {
      const editor = view.editor;
      generateEntityCommand(this.plugin, editor, view, entityDefn);
    }
  }

  handleOracleRoll(oracle: Oracle) {
    const { workspace } = this.plugin.app;
    const view = workspace.getActiveFileView();
    if (view && view instanceof MarkdownView) {
      const editor = view.editor;
      runOracleCommand(this.plugin, editor, view, oracle);
    }
  }

  openOracleModal(oracle: Oracle) {
    new OracleModal(this.plugin.app, this.plugin, oracle).open();
  }
}

interface OracleIndexEntry {
  id: string;
  name: string;
  group: string;
  ruleset: string;
}

interface RulesetGrouping {
  name: string;
  id: string;
  children: CollectionGrouping[];
}

interface CollectionGrouping {
  name: string;
  id: string;
  children: Oracle[];
}

function getOracleTree(
  dataContext: IDataContext,
  searchIdx: MiniSearch<OracleIndexEntry>,
  filter?: string,
) {
  const results = filter
    ? searchIdx.search(filter)
    : [...dataContext.oracles.values()];
  const rulesets: Map<string, RulesetGrouping> = new Map();
  const groupings: Map<string, CollectionGrouping> = new Map();
  let total = 0;
  for (const res of results) {
    const oracle = dataContext.oracles.get(res.id)!;
    let topGroup = oracle.parent;
    let groupName = topGroup.name;
    while (
      topGroup &&
      topGroup.grouping_type === "collection" &&
      topGroup.parent.grouping_type === "collection"
    ) {
      topGroup = topGroup.parent;
      groupName = `${topGroup.name} > ${groupName}`;
    }

    const top =
      topGroup.grouping_type === "collection"
        ? topGroup.parent
        : ({
            name: "Homebrew",
            id: "iron_vault_homebrew",
          } as OracleRulesetGrouping);

    let ruleset = rulesets.get(top.id);
    if (!ruleset) {
      ruleset = {
        id: top.id,
        name: top.name,
        children: [],
      };
      rulesets.set(ruleset.id, ruleset);
    }

    let grouping = groupings.get(oracle.parent.id);
    if (!grouping) {
      grouping = {
        id: oracle.parent.id,
        name: groupName,
        children: [],
      };
      ruleset.children.push(grouping);
      groupings.set(oracle.parent.id, grouping);
    }

    grouping.children.push(oracle);
    total += 1;
  }
  return { rulesets: rulesets.values(), total };
}

function renderGroup(
  behaviors: OracleViewBehaviors,
  group: CollectionGrouping,
  open: boolean,
  onToggle?: (ev: ToggleEvent) => void | Promise<void>,
) {
  return renderGrouping({
    open,
    onToggle,
    name: group.name,
    listItemClass: "oracle-group",
    children: [
      html`<li
        class="oracle-item"
        @click=${(ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          behaviors.onClickOracleGroup(group);
        }}
      >
        <span>
          <span
            ${ref((el?: Element) => el && setIcon(el as HTMLElement, "dice"))}
          ></span>
          Roll All</span
        >
      </li>`,
      ...group.children.map((oracle) => renderOracle(behaviors, oracle)),
    ],
  });
}

function renderOracle(behaviors: OracleViewBehaviors, oracle: Oracle) {
  return html`
    <li
      class="oracle-item"
      @click=${(ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        behaviors.onClickOracleName(oracle);
      }}
    >
      <span>
        <span
          ${ref((el?: Element) => el && setIcon(el as HTMLElement, "dice"))}
        ></span>
        ${oracle.name}</span
      >
      <button
        type="button"
        @click=${(ev: MouseEvent) => {
          ev.stopPropagation();
          behaviors.onClickOracleDetails(oracle);
        }}
      >
        ${getIcon("list")}
      </button>
    </li>
  `;
}

function makeIndex(dataContext: IDataContext): MiniSearch<OracleIndexEntry> {
  const idx = new MiniSearch<OracleIndexEntry>({
    fields: ["name", "group", "ruleset"],
    idField: "id",
    searchOptions: {
      prefix: true,
      fuzzy: 0.3,
      boost: { name: 2 },
    },
  });
  for (const oracle of dataContext.oracles.values()) {
    let topGroup = oracle.parent;
    let groupName = topGroup.name;
    while (
      topGroup &&
      topGroup.grouping_type === "collection" &&
      topGroup.parent.grouping_type === "collection"
    ) {
      topGroup = topGroup.parent;
      groupName = `${topGroup.name} > ${groupName}`;
    }

    const top =
      topGroup.grouping_type === "collection"
        ? topGroup.parent
        : ({
            name: "Homebrew",
            id: "iron_vault_homebrew",
          } as OracleRulesetGrouping);

    idx.add({
      id: oracle.id,
      name: oracle.name,
      group: groupName,
      ruleset: top.name,
    });
  }
  return idx;
}
