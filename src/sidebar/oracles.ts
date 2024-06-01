import IronVaultPlugin from "index";
import { MarkdownView, getIcon } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { OracleModal } from "oracles/oracle-modal";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { Oracle, OracleRulesetGrouping } from "model/oracle";

export default async function renderIronVaultOracles(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
) {
  const loading = cont.createEl("p", { text: "Loading data..." });
  await plugin.datastore.waitForReady;
  loading.remove();
  const { rulesets, total } = getOracleTree(plugin);
  litOracleList(cont, plugin, [...rulesets], total);
}

interface RulesetGrouping {
  name: string;
  id: string;
  children: CollectionGrouping[];
}

interface CollectionGrouping {
  name: string;
  children: Oracle[];
}

function getOracleTree(plugin: IronVaultPlugin, filter?: string) {
  const oracles = plugin.datastore.oracles;
  const rulesets: Map<string, RulesetGrouping> = new Map();
  const groupings: Map<string, CollectionGrouping> = new Map();
  let total = 0;
  for (const oracle of oracles.values()) {
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

    if (
      filter &&
      !oracle.name.toLowerCase().includes(filter) &&
      !groupName.toLowerCase().includes(filter)
    ) {
      continue;
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

    let grouping = groupings.get(groupName);
    if (!grouping) {
      grouping = {
        name: groupName,
        children: [],
      };
      ruleset.children.push(grouping);
      groupings.set(groupName, grouping);
    }

    grouping.children.push(oracle);
    total += 1;
  }
  return { rulesets: rulesets.values(), total };
}

function litOracleList(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
  rulesets: RulesetGrouping[],
  total: number,
) {
  return render(
    html`
      <input
        class="search-box"
        type="search"
        placeholder="Filter oracles..."
        @input=${(e: Event) => {
          const input = e.target as HTMLInputElement;
          const query = input.value.toLowerCase();
          const { rulesets, total } = getOracleTree(plugin, query);
          litOracleList(cont, plugin, [...rulesets], total);
        }}
      />
      <ul class="iron-vault-oracles-list">
        ${map(rulesets, (r) => renderRuleset(plugin, r, total <= 5))}
      </ul>
    `,
    cont,
  );
}

function renderRuleset(
  plugin: IronVaultPlugin,
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
          ${map(ruleset.children, (group) => renderGroup(plugin, group, open))}
        </ul>
      </div>
    </li>
  `;
}

function renderGroup(
  plugin: IronVaultPlugin,
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
          <li>
            <button
              type="button"
              @click=${() => rollOracleBatch(plugin, group.children)}
            >
              ${getIcon("dice")}
            </button>
          </li>
          ${map(group.children, (oracle) => renderOracle(plugin, oracle))}
        </ul>
      </div>
    </li>
  `;
}

function renderOracle(plugin: IronVaultPlugin, oracle: Oracle) {
  return html`
    <li @click=${(ev: MouseEvent) => handleOracleRoll(ev, plugin, oracle)}>
      <span>${oracle.name}</span>
      <button type="button" @click=${() => openOracleModal(plugin, oracle)}>
        ${getIcon("list")}
      </button>
    </li>
  `;
}

function rollOracleBatch(plugin: IronVaultPlugin, oracles: Oracle[]) {
  // TODO(@zkat): actually hook this up.
  console.log("Rolling all these oracles:", oracles);
}

function handleOracleRoll(
  ev: MouseEvent,
  plugin: IronVaultPlugin,
  oracle: Oracle,
) {
  ev.stopPropagation();
  ev.preventDefault();
  const { workspace } = plugin.app;
  const view = workspace.getActiveFileView();
  if (view && view instanceof MarkdownView) {
    const editor = view.editor;
    runOracleCommand(plugin.app, plugin.datastore, editor, view, oracle);
  }
}

function openOracleModal(plugin: IronVaultPlugin, oracle: Oracle) {
  new OracleModal(plugin.app, plugin, oracle).open();
}
