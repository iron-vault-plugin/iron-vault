import ForgedPlugin from "index";
import { MarkdownView, getIcon } from "obsidian";
import { runOracleCommand } from "oracles/command";
import { OracleModal } from "oracles/oracle-modal";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { Oracle, OracleRulesetGrouping } from "model/oracle";

export default async function renderForgedOracles(
  cont: HTMLElement,
  plugin: ForgedPlugin,
) {
  const loading = cont.createEl("p", { text: "Loading data..." });
  await plugin.datastore.waitForReady;
  loading.remove();
  render(renderOracleList(plugin), cont);
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

function getOracleTree(plugin: ForgedPlugin) {
  const oracles = plugin.datastore.oracles;
  const rulesets: Map<string, RulesetGrouping> = new Map();
  const groupings: Map<string, CollectionGrouping> = new Map();
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

    const top =
      topGroup.grouping_type === "collection"
        ? topGroup.parent
        : ({
            name: "Homebrew",
            id: "forged_homebrew",
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
  }
  return rulesets.values();
}

function renderOracleList(plugin: ForgedPlugin) {
  const rulesets = getOracleTree(plugin);
  return html`
    <ul class="oracles-list">
      ${map(rulesets, (r) => renderRuleset(plugin, r))}
    </ul>
  `;
}

function renderRuleset(plugin: ForgedPlugin, ruleset: RulesetGrouping) {
  return html`
    <li class="ruleset">
      <div class="wrapper">
        <details open>
          <summary><span>${ruleset.name}</span></summary>
        </details>
        <ul class="content">
          ${map(ruleset.children, (group) => renderGroup(plugin, group))}
        </ul>
      </div>
    </li>
  `;
}

function renderGroup(plugin: ForgedPlugin, group: CollectionGrouping) {
  return html`
    <li class="oracle-group">
      <div class="wrapper">
        <details>
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

function renderOracle(plugin: ForgedPlugin, oracle: Oracle) {
  return html`
    <li @click=${(ev: MouseEvent) => handleOracleRoll(ev, plugin, oracle)}>
      <span>${oracle.name}</span>
      <button type="button" @click=${() => openOracleModal(plugin, oracle)}>
        ${getIcon("list")}
      </button>
    </li>
  `;
}

function rollOracleBatch(plugin: ForgedPlugin, oracles: Oracle[]) {
  // TODO(@zkat): actually hook this up.
  console.log("Rolling all these oracles:", oracles);
}

function handleOracleRoll(
  ev: MouseEvent,
  plugin: ForgedPlugin,
  _oracle: Oracle,
) {
  ev.stopPropagation();
  ev.preventDefault();
  const { workspace } = plugin.app;
  const editor = workspace.activeEditor?.editor;
  const view = workspace.getActiveViewOfType(MarkdownView);
  // TODO(@zkat): Hook this up properly. We probably don't want the command itself.
  if (editor && view) {
    runOracleCommand(plugin.app, plugin.datastore, editor, view);
  }
}

function openOracleModal(plugin: ForgedPlugin, oracle: Oracle) {
  new OracleModal(plugin.app, plugin, oracle).open();
}
