import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { CampaignDataContext } from "campaigns/context";
import { IDataContext } from "datastore/data-context";
import { generateEntityCommand } from "entity/command";
import { ENTITIES } from "entity/specs";
import IronVaultPlugin from "index";
import { html, render, TemplateResult } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import MiniSearch from "minisearch";
import { Oracle, OracleRulesetGrouping } from "model/oracle";
import { getIcon, MarkdownView, SearchComponent, setIcon } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { OracleModal } from "oracles/oracle-modal";

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

  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    sourcePath?: string,
  ) {
    super(containerEl, plugin, sourcePath, true);
    this.contentEl = containerEl.createDiv({
      cls: "iron-vault-oracle-list-container",
    });
    this.search = new SearchComponent(this.contentEl)
      .setPlaceholder("Filter moves...")
      .onChange((query) => {
        this.filter = query.trim();
        this.render();
      });
  }

  onunload() {
    this.contentEl.remove();
  }

  protected onNewContext(context: CampaignDataContext | undefined): void {
    this.index = context && makeIndex(context);
  }

  updateView(view: MarkdownView | undefined) {
    if (view !== this.targetView) {
      this.targetView = view;
      this.triggerUpdate();
    }
  }

  render() {
    const behaviors: OracleViewBehaviors = {
      onClickOracleDetails: (oracle) => {
        openOracleModal(this.plugin, oracle);
      },
      onClickOracleName: (oracle) => {
        handleOracleRoll(this.plugin, oracle);
      },
      onClickOracleGroup: (group) => {
        rollOracleBatch(this.plugin, group);
      },
    };
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
              children: html`${map(r.children, (group) =>
                renderGroup(behaviors, group, total <= 5),
              )}`,
            }),
          )}
        </ul>
      `,
      this.contentEl,
    );
  }

  renderWithoutContext(): void | Promise<void> {
    render(
      html`<article class="error">
        This block may only be used within a campaign.
      </article>`,
      this.contentEl,
    );
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

export function renderRuleset({
  open,
  name,
  children,
}: {
  open?: boolean;
  name: string;
  children: TemplateResult;
}): TemplateResult {
  return html`
    <li class="ruleset">
      <details ?open=${open}>
        <summary><span>${name}</span></summary>
      </details>
      <ul class="content">
        ${children}
      </ul>
    </li>
  `;
}

function renderGroup(
  behaviors: OracleViewBehaviors,
  group: CollectionGrouping,
  open: boolean,
) {
  return html`
    <li class="oracle-group">
      <details ?open=${open}>
        <summary><span>${group.name}</span></summary>
      </details>
      <ul class="content">
        <li
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
        </li>
        ${map(group.children, (oracle) => renderOracle(behaviors, oracle))}
      </ul>
    </li>
  `;
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

function rollOracleBatch(plugin: IronVaultPlugin, group: CollectionGrouping) {
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
  const { workspace } = plugin.app;
  const view = workspace.getActiveFileView();
  if (view && view instanceof MarkdownView) {
    const editor = view.editor;
    generateEntityCommand(plugin, editor, view, entityDefn);
  }
}

function handleOracleRoll(plugin: IronVaultPlugin, oracle: Oracle) {
  const { workspace } = plugin.app;
  const view = workspace.getActiveFileView();
  if (view && view instanceof MarkdownView) {
    const editor = view.editor;
    runOracleCommand(plugin, editor, view, oracle);
  }
}

function openOracleModal(plugin: IronVaultPlugin, oracle: Oracle) {
  new OracleModal(plugin.app, plugin, oracle).open();
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
