import { IDataContext } from "datastore/data-context";
import { generateEntityCommand } from "entity/command";
import { ENTITIES } from "entity/specs";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import MiniSearch from "minisearch";
import { Oracle, OracleRulesetGrouping } from "model/oracle";
import { MarkdownView, getIcon, setIcon } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { OracleModal } from "oracles/oracle-modal";

type OracleViewBehaviors = {
  onClickOracleName: (oracle: Oracle) => void;
  onClickOracleDetails: (oracle: Oracle) => void;
  onClickOracleGroup: (group: CollectionGrouping) => void;
};

export default function renderIronVaultOracles(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
  dataContext: IDataContext,
) {
  const idx = makeIndex(dataContext);
  const behaviors: OracleViewBehaviors = {
    onClickOracleDetails(oracle) {
      openOracleModal(plugin, oracle);
    },
    onClickOracleName(oracle) {
      handleOracleRoll(plugin, oracle);
    },
    onClickOracleGroup(group) {
      rollOracleBatch(plugin, group);
    },
  };
  litOracleList(cont, behaviors, dataContext, idx);
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

function litOracleList(
  cont: HTMLElement,
  behaviors: OracleViewBehaviors,
  dataContext: IDataContext,
  index: MiniSearch<OracleIndexEntry>,
  filter?: string,
) {
  const { rulesets, total } = getOracleTree(dataContext, index, filter);
  return render(
    html`
      <input
        class="search-box"
        type="search"
        placeholder="Filter oracles..."
        @input=${(e: Event) => {
          const input = e.target as HTMLInputElement;
          litOracleList(cont, behaviors, dataContext, index, input.value);
        }}
      />
      <ul class="iron-vault-oracles-list">
        ${map(rulesets, (r) => renderRuleset(behaviors, r, total <= 5))}
      </ul>
    `,
    cont,
  );
}

function renderRuleset(
  behaviors: OracleViewBehaviors,
  ruleset: RulesetGrouping,
  open: boolean,
) {
  return html`
    <li class="ruleset">
      <div class="wrapper">
        <details open>
          <summary><span>${ruleset.name}</span></summary>
        </details>
        <ul class="content">
          ${map(ruleset.children, (group) =>
            renderGroup(behaviors, group, open),
          )}
        </ul>
      </div>
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
      <div class="wrapper">
        <details ?open=${open}>
          <summary><span>${group.name}</span></summary>
        </details>
        <ul class="content">
          <li
            @click=${(ev: MouseEvent) => {
              ev.stopPropagation();
              ev.preventDefault();
              behaviors.onClickOracleGroup(group);
            }}
          >
            <span>
              <span
                ${ref(
                  (el?: Element) => el && setIcon(el as HTMLElement, "dice"),
                )}
              ></span>
              Roll All</span
            >
          </li>
          ${map(group.children, (oracle) => renderOracle(behaviors, oracle))}
        </ul>
      </div>
    </li>
  `;
}

function renderOracle(behaviors: OracleViewBehaviors, oracle: Oracle) {
  return html`
    <li
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

function makeIndex(dataContext: IDataContext) {
  const idx = new MiniSearch({
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
