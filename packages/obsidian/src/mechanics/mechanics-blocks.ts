import { html, render, TemplateResult } from "lit-html";
import { ref } from "lit-html/directives/ref.js";
import { styleMap } from "lit-html/directives/style-map.js";
import {
  ButtonComponent,
  MarkdownPostProcessorContext,
  MarkdownPreviewView,
  MarkdownView,
  Menu,
} from "obsidian";
import { format, Node as KdlNodeBare, parse } from "utils/kdl";

import {
  evaluateExpr,
  toStringWithValues,
  tryParseDiceExpression,
} from "@ironvault/dice";
import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { IDataContext } from "datastore/data-context";
import { DataswornTypes } from "datastore/datasworn-indexer";
import { repeat } from "lit-html/directives/repeat.js";
import Sortable from "sortablejs";
import { ProgressTrack } from "tracks/progress";
import { tryOrElse } from "true-myth/result";
import { node } from "utils/kdl";
import { md } from "utils/ui/directives";
import IronVaultPlugin from "../index";
import { diceExprNode, MechanicsDiceExprNode } from "./node-builders";

interface KdlNode extends KdlNodeBare {
  parent?: KdlNode;
  _nodeId?: string;
  _docIdx?: number;
}

let DOC_IDX = 0;

function makeHandler(plugin: IronVaultPlugin) {
  return async (
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ) => {
    ctx.addChild(new MechanicsRenderer(el, source, plugin, ctx));
  };
}

export default function registerMechanicsBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-mechanics",
    makeHandler(plugin),
  );
  plugin.registerMarkdownCodeBlockProcessor("mechanics", makeHandler(plugin));
}

interface MechanicsContainerEl extends HTMLElement {
  mechanicsRenderer?: MechanicsRenderer;
}

export class MechanicsRenderer extends CampaignDependentBlockRenderer {
  lastRoll: KdlNode | undefined;
  moveEl: HTMLElement | undefined;
  doc?: KdlNode;
  activeMenu?: Menu;
  hideMechanics = false;
  #moves?: DataswornTypes["move"][];

  constructor(
    contentEl: HTMLElement,
    public source: string,
    public plugin: IronVaultPlugin,
    public ctx: MarkdownPostProcessorContext,
  ) {
    super(contentEl, plugin, ctx.sourcePath, {
      watchDataIndex: true,
    });
    if ((contentEl as MechanicsContainerEl).mechanicsRenderer) {
      console.warn("Mechanics block already registered");
    }
    (contentEl as MechanicsContainerEl).mechanicsRenderer = this;
    const res = parse(this.source);
    if (res.output) {
      this.doc = node("doc", { children: res.output });
      this.fillNodeIds();
      this.fillParents(this.doc.children, this.doc);
    }
    this.register(
      plugin.settings.on("change", ({ key, oldValue, newValue }) => {
        if (
          oldValue !== newValue &&
          (key === "showMechanicsToggle" ||
            key === "collapseMoves" ||
            key === "hideMechanics")
        ) {
          this.update();
        }
      }),
    );
  }

  fillParents(nodes: KdlNode[], parent?: KdlNode) {
    for (const node of nodes) {
      node.parent = parent;
      this.fillParents(node.children, node);
    }
  }

  fillNodeIds() {
    if (!this.doc) {
      return;
    }
    const doc = this.doc;
    doc._docIdx = DOC_IDX++;
    let node_idx = 0;
    rec(this.doc.children);
    function rec(nodes: KdlNode[]) {
      for (const node of nodes) {
        node._nodeId = `doc-${doc._docIdx}/node-${node_idx++}`;
        rec(node.children);
      }
    }
  }

  renderWithoutContext(): void | Promise<void> {
    // If we don't have a campaign context, that's cool-- let's just use the global context
    // for rendering moves, etc.
    // This kinda violates the assumptions that CampaignDependentBlockRenderer makes, but
    // we should be fine b/c we don't directly request the campaign context fields anywhere.
    return this.#render(this.plugin.datastore.dataContext);
  }

  render() {
    return this.#render(this.dataContext);
  }

  #render(context: IDataContext) {
    this.containerEl.empty();
    this.lastRoll = undefined;
    if (this.plugin.settings.hideMechanics) {
      render(html``, this.containerEl.createDiv());
      return;
    }
    if (!this.doc) {
      // TODO: give line/column information for errors.
      render(
        html`<pre>
Error parsing mechanics block: KDL text was invalid.
See https://kdl.dev for syntax.</pre
        >`,
        this.containerEl.createDiv(),
      );
      return;
    }
    this.#moves = [...context.moves.values()];
    const tpl = html`<article
      class="iron-vault-mechanics"
      style=${styleMap({
        "--vs1-color": this.plugin.settings.challengeDie1Color,
        "--vs2-color": this.plugin.settings.challengeDie2Color,
      })}
      @contextmenu=${this.makeMenuHandler(this.doc)}
      ${ref((el?: Element) => {
        if (
          !el ||
          !this.plugin.settings.showMechanicsToggle ||
          (el as HTMLElement).querySelector(".toggle")
        )
          return;
        const btn = new ButtonComponent(el as HTMLElement);
        btn
          .setButtonText(
            this.hideMechanics ? "Show mechanics" : "Hide mechanics",
          )
          .setClass("toggle")
          .setTooltip("Toggle displaying mechanics")
          .onClick(() => {
            this.hideMechanics = !this.hideMechanics;
            btn.setButtonText(
              this.hideMechanics ? "Show mechanics" : "Hide mechanics",
            );
            this.update();
          });
      })}
    >
      <div ${ref((el) => makeSortable(el, this.doc!))}>
        ${this.hideMechanics ? null : this.renderChildren(this.doc.children)}
      </div>
    </article>`;
    render(tpl, this.containerEl.createDiv());
  }

  makeMenuHandler(node: KdlNode) {
    return (ev: MouseEvent) => {
      const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || view.currentMode instanceof MarkdownPreviewView) {
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();

      this.activeMenu = new Menu();

      this.activeMenu.onunload = () => (this.activeMenu = undefined);

      this.activeMenu.addItem((item) => {
        item
          .setTitle(
            `Delete ${node.name === "-" ? "comment" : node === this.doc ? "mechanics block" : node.name}`,
          )
          .setIcon("trash")
          .onClick(() => {
            if (node.parent) {
              const idx = node.parent.children.indexOf(node);
              if (idx >= 0) {
                node.parent.children.splice(idx, 1);
                this.updateBlock();
              }
            } else if (node === this.doc) {
              // We probably don't need this if, but just to make sure.
              node.children = [];
              this.updateBlock();
            }
          });
      });

      this.activeMenu.showAtMouseEvent(ev);
    };
  }

  updateBlock(offset: number = 0) {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = this.plugin.app.workspace.activeEditor?.editor;
    const sectionInfo = this.ctx.getSectionInfo(this.containerEl);
    if (
      !editor ||
      !sectionInfo ||
      !this.doc ||
      !view ||
      view.currentMode instanceof MarkdownPreviewView
    ) {
      return;
    }
    const start = sectionInfo.lineStart + offset;
    const end = sectionInfo.lineEnd + offset;
    const editorRange = {
      from: {
        ch: 0,
        line: start,
      },
      to: {
        ch: editor.getLine(end).length,
        line: end,
      },
    };
    const replacement = this.doc.children.length
      ? `\`\`\`iron-vault-mechanics\n${format(this.doc.children)}\`\`\``
      : "";
    editor.replaceRange(replacement, editorRange.from, editorRange.to);
    const oldLineCount = end - start;
    const newLineCount = replacement.split(/\r\n|\r|\n/g).length - 1;
    const newOffset = newLineCount - oldLineCount;
    editor.focus();
    // const moveTo = editorRange.from.line;
    // NB(@zkat): This prevents the editor jumping around.
    // editor.setCursor({ ch: 0, line: moveTo >= 0 ? moveTo : 0 });
    return newOffset;
  }

  renderChildren(nodes: KdlNode[]): TemplateResult {
    return html`${repeat(
      nodes,
      (node) => node._nodeId,
      (node) => this.renderNode(node),
    )}`;
  }

  renderNode(node: KdlNode) {
    switch (node.name.toLowerCase()) {
      case "move": {
        return this.renderMove(node);
      }
      case "-": {
        return this.renderDetails(node);
      }
      case "add": {
        return this.renderAdd(node);
      }
      case "roll": {
        this.lastRoll = structuredClone(node);
        this.lastRoll.properties.action =
          node.properties.action ?? node.values[1];
        this.lastRoll.properties.stat = node.properties.stat ?? node.values[2];
        this.lastRoll.properties.adds = node.properties.adds ?? node.values[3];
        this.lastRoll.properties.vs1 = node.properties.vs1 ?? node.values[4];
        this.lastRoll.properties.vs2 = node.properties.vs2 ?? node.values[5];
        return this.renderRoll(node);
      }
      case "progress-roll": {
        this.lastRoll = structuredClone(node);
        this.lastRoll.properties.score =
          node.properties.score ?? node.values[1];
        this.lastRoll.properties.vs1 = node.properties.vs1 ?? node.values[2];
        this.lastRoll.properties.vs2 = node.properties.vs2 ?? node.values[3];
        return this.renderProgressRoll(node);
      }
      case "die-roll": {
        // TODO: actually style these.
        return this.renderDieRoll(node);
      }
      case "reroll": {
        return this.renderReroll(node);
      }
      case "meter": {
        return this.renderMeter(node);
      }
      case "burn": {
        return this.renderBurn(node);
      }
      case "progress": {
        return this.renderProgress(node);
      }
      case "track": {
        return this.renderTrack(node);
      }
      case "xp": {
        return this.renderXp(node);
      }
      case "clock": {
        return this.renderClock(node);
      }
      case "oracle": {
        return this.renderOracle(node);
      }
      case "oracle-group": {
        return this.renderOracleGroup(node);
      }
      case "asset": {
        return this.renderAsset(node);
      }
      case "impact": {
        return this.renderImpact(node);
      }
      case "initiative":
      case "position": {
        return this.renderInitiative(node);
      }
      case "actor": {
        return this.renderActor(node);
      }
      case "dice-expr": {
        const result = diceExprNode.safeParse(node);
        if (result.success) {
          return this.renderDiceExpr(result.data, node);
        } else {
          return this.renderInvalid(node, result.error);
        }
      }
      default: {
        return this.renderUnknown(node);
      }
    }
  }

  renderMove(node: KdlNode): TemplateResult {
    const id = node.properties.id as string | undefined;
    const name = (node.properties.name ?? node.values[0]) as string | undefined;
    const move = id
      ? (this.#moves!.find((x) => x._id === id) ??
        this.#moves!.find((x) => x.name.toLowerCase() === name?.toLowerCase()))
      : this.#moves!.find((x) => x.name.toLowerCase() === name?.toLowerCase());
    const moveName = name ?? move?.name ?? "Unknown move";
    return html`<details
      class="move"
      ?open=${!this.plugin.settings.collapseMoves}
      @contextmenu=${this.makeMenuHandler(node)}
      ${ref((el) => (this.moveEl = el as HTMLElement | undefined))}
    >
      <summary>${md(this.plugin, moveName)}</summary>
      <div ${ref((el) => makeSortable(el, node))}>
        ${this.renderChildren(node.children)}
      </div>
    </details>`;
  }

  renderDetails(node: KdlNode) {
    const details = node.values.reduce((acc, val) => {
      if (typeof val === "string") {
        acc.push(...val.split("\n"));
      }
      return acc;
    }, [] as string[]);
    return html`<aside
      class="detail"
      @contextmenu=${this.makeMenuHandler(node)}
    >
      ${md(this.plugin, "> " + details.join("\n> "))}
    </aside>`;
  }

  renderAdd(node: KdlNode) {
    const amount = (node.properties.amount ?? node.values[0]) as number;
    const from = (node.properties.from ?? node.values[1]) as string;
    const neg = amount < 0;
    const def: DataList = {
      Amount: {
        cls: "amount" + " " + (neg ? "negative" : "positive"),
        value: Math.abs(amount),
      },
    };
    if (from) {
      def["From"] = { cls: "from", value: from, md: true };
    }
    return this.renderDlist("add", def, node);
  }

  renderMeter(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const from = (node.properties.from ?? node.values[1]) as number;
    const to = (node.properties.to ?? node.values[2]) as number;
    const delta = to - from;
    const neg = delta < 0;
    return this.renderDlist(
      "meter",
      {
        Meter: { cls: "meter-name", value: name, md: true },
        Delta: {
          cls: "delta" + " " + (neg ? "negative" : "positive"),
          value: Math.abs(delta),
        },
        From: { cls: "from", value: from },
        To: { cls: "to", value: to },
      },
      node,
    );
  }

  renderBurn(node: KdlNode) {
    const from = Math.max(
      -6,
      Math.min((node.properties.from ?? node.values[0]) as number, 10),
    );
    const to = Math.max(
      -6,
      Math.min((node.properties.to ?? node.values[1]) as number, 10),
    );
    const def: DataList = {
      From: { cls: "from", value: from },
      To: { cls: "to", value: to },
    };
    let nodeCls = "burn";
    if (this.lastRoll && this.lastRoll.name === "progress-roll") {
      return html`<p class="error">Can't burn momentum on progress rolls.</p>`;
    } else if (this.lastRoll) {
      const vs1 = this.lastRoll.properties.vs1 as number;
      const vs2 = this.lastRoll.properties.vs2 as number;
      def["New score"] = { cls: "score", value: from };
      def["Challenge die 1"] = {
        cls: "challenge-die vs1",
        value: vs1,
      };
      def["Challenge die 2"] = {
        cls: "challenge-die vs2",
        value: vs2,
      };
      const { cls, text, match } = rollOutcome(from, vs1, vs2);
      this.setMoveHit(cls, match);
      def["Outcome"] = { cls: "outcome", value: text, dataProp: false };
      nodeCls += " " + cls;
    }
    return this.renderDlist(nodeCls, def, node);
  }

  renderProgress(node: KdlNode) {
    const trackName = (node.properties.name ?? node.values[0]) as string;
    const result = ProgressTrack.create({
      progress:
        node.properties.from ??
        ((node.properties["from-boxes"] as number) ?? 0) * 4 +
          ((node.properties["from-ticks"] as number) ?? 0),
      rank: node.properties.rank ?? node.properties.level,
      unbounded: (node.properties.unbounded ?? false) as boolean,
      complete: false,
    });
    if (result.isLeft()) {
      // todo: Better error display
      return html`<pre class="error">
Invalid track:
${result.error.toString()}</pre
      >`;
    }
    const startTrack = result.value;

    const [fromBoxes, fromTicks] = startTrack.boxesAndTicks();
    const rank = startTrack.rank;
    const steps = (node.properties.steps ?? node.values[3] ?? 1) as number;

    const endTrack = startTrack.advanced(steps);
    const [toBoxes, toTicks] = endTrack.boxesAndTicks();
    return this.renderDlist(
      "progress",
      {
        "Track name": { cls: "track-name", value: trackName, md: true },
        Steps: {
          cls: "steps " + (steps < 0 ? "negative" : "positive"),
          value: steps,
        },
        Rank: { cls: "rank", value: rank },
        "From boxes": { cls: "from-boxes", value: fromBoxes },
        "From ticks": { cls: "from-ticks", value: fromTicks },
        "To boxes": { cls: "to-boxes", value: toBoxes },
        "To ticks": { cls: "to-ticks", value: toTicks },
      },
      node,
    );
  }

  renderTrack(node: KdlNode) {
    const trackName = (node.properties.name ?? node.values[0]) as string;
    const status = node.properties.status as string | undefined;
    if (status != null) {
      return this.renderDlist(
        "track-status",
        {
          Track: { cls: "track-name", value: trackName, md: true },
          Status: { cls: "track-status", value: status },
        },
        node,
      );
    }
    let from = node.properties.from as number;
    const fromBoxes =
      (node.properties["from-boxes"] as number) ??
      (from != null ? Math.floor(from / 4) : 0);
    const fromTicks =
      (node.properties["from-ticks"] as number) ??
      (from != null ? from % 4 : 0);
    if (from == null) {
      from = fromBoxes * 4 + fromTicks;
    }
    let to = node.properties.to as number;
    const toBoxes =
      (node.properties["to-boxes"] as number) ??
      (to != null ? Math.floor(to / 4) : 0);
    const toTicks =
      (node.properties["to-ticks"] as number) ?? (to != null ? to % 4 : 0);
    if (to == null) {
      to = toBoxes * 4 + toTicks;
    }
    return this.renderDlist(
      "track",
      {
        "Track name": { cls: "track-name", value: trackName, md: true },
        "From boxes": { cls: "from-boxes", value: fromBoxes },
        "From ticks": { cls: "from-ticks", value: fromTicks },
        "To boxes": { cls: "to-boxes", value: toBoxes },
        "To ticks": { cls: "to-ticks", value: toTicks },
      },
      node,
    );
  }

  renderXp(node: KdlNode) {
    const from = (node.properties.from ?? node.values[0]) as number;
    const to = (node.properties.to ?? node.values[1]) as number;
    const delta = to - from;
    const neg = delta < 0;
    return this.renderDlist(
      "xp",
      {
        Delta: {
          cls: "delta" + " " + (neg ? "negative" : "positive"),
          value: Math.abs(delta),
        },
        From: { cls: "from", value: from },
        To: { cls: "to", value: to },
      },
      node,
    );
  }

  renderClock(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const status = node.properties.status as string | undefined;
    if (status != null) {
      return this.renderDlist(
        "clock-status",
        {
          Clock: { cls: "clock-name", value: name, md: true },
          Status: { cls: "clock-status", value: status },
        },
        node,
      );
    }
    const from = (node.properties.from ?? node.values[1]) as number;
    const to = (node.properties.to ?? node.values[2]) as number;
    const outOf = (node.properties["out-of"] ?? node.values[3]) as number;
    return this.renderDlist(
      "clock",
      {
        Clock: { cls: "clock-name", value: name, md: true },
        From: { cls: "from", value: from },
        "Out of from": { cls: "out-of", value: outOf },
        To: { cls: "to", value: to },
        "Out of to": { cls: "out-of", value: outOf },
      },
      node,
    );
  }

  renderOracle(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const roll = (node.properties.roll ?? node.values[1]) as number;
    const result = (node.properties.result ?? node.values[2]) as string;
    const cursed = (node.properties.cursed ?? node.values[3]) as
      | number
      | undefined;
    const replaced = (node.properties.replaced ?? node.values[4]) as
      | boolean
      | undefined;
    const data: DataList = {
      Name: { cls: "name", value: name, md: true },
      Roll: { cls: "roll", value: roll },
      Result: { cls: "result", value: result, md: true },
    };
    if (cursed != null) {
      data.cursed = { cls: "cursed", value: cursed };
    }
    if (replaced != null) {
      data.replaced = { cls: "replaced", value: replaced };
    }
    return html`<div
      class="oracle-container"
      @contextmenu=${this.makeMenuHandler(node)}
    >
      ${this.renderDlist("oracle", data, node)}
      ${node.children.length
        ? html`<blockquote ${ref((el) => makeSortable(el, node))}>
            ${this.renderChildren(node.children)}
          </blockquote>`
        : null}
    </div>`;
  }

  renderOracleGroup(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    return html`<article
      class="oracle-group"
      @contextmenu=${this.makeMenuHandler(node)}
    >
      ${md(this.plugin, name)}
      ${node.children.length
        ? html`<blockquote ${ref((el) => makeSortable(el, node))}>
            ${this.renderChildren(node.children)}
          </blockquote>`
        : null}
    </article>`;
  }

  renderRoll(node: KdlNode) {
    const statName = (node.properties["stat-name"] ?? node.values[0]) as string;
    const action = (node.properties.action ?? node.values[1]) as number;
    const stat = (node.properties.stat ?? node.values[2]) as number;
    const adds = (node.properties.adds ?? node.values[3] ?? 0) as number;
    const score = Math.min(10, action + stat + adds);
    const challenge1 = (node.properties.vs1 ?? node.values[4]) as number;
    const challenge2 = (node.properties.vs2 ?? node.values[5]) as number;
    const {
      cls: outcomeClass,
      text: outcome,
      match,
    } = rollOutcome(score, challenge1, challenge2);
    this.setMoveHit(outcomeClass, match);
    const def: DataList = {
      "Action die": { cls: "action-die", value: action },
      Stat: { cls: "stat", value: stat },
    };
    if (statName) {
      def["Stat name"] = { cls: "stat-name", value: statName };
    }
    Object.assign(def, {
      Adds: { cls: "adds", value: adds },
      Score: { cls: "score", value: score },
      "Challenge die 1": { cls: "challenge-die vs1", value: challenge1 },
      "Challenge die 2": { cls: "challenge-die vs2", value: challenge2 },
      Outcome: { cls: "outcome", value: outcome, dataProp: false },
    });
    return this.renderDlist("roll " + outcomeClass, def, node);
  }

  renderProgressRoll(node: KdlNode) {
    const trackName = (node.properties.name ?? node.values[0]) as string;
    const score = (node.properties.score ?? node.values[1]) as number;
    const challenge1 = (node.properties.vs1 ?? node.values[2]) as number;
    const challenge2 = (node.properties.vs2 ?? node.values[3]) as number;
    const {
      cls: outcomeClass,
      text: outcome,
      match,
    } = rollOutcome(score, challenge1, challenge2);
    this.setMoveHit(outcomeClass, match);
    return this.renderDlist(
      "roll progress " + outcomeClass,
      {
        "Track name": { cls: "track-name", value: trackName, md: true },
        "Progress score": { cls: "progress-score", value: score },
        "Challenge die 1": { cls: "challenge-die vs1", value: challenge1 },
        "Challenge die 2": { cls: "challenge-die vs2", value: challenge2 },
        Outcome: { cls: "outcome", value: outcome, dataProp: false },
      },
      node,
    );
  }

  renderDieRoll(node: KdlNode) {
    const reason = node.values[0] as string;
    const value = node.values[1] as number;
    return this.renderDlist(
      "die-roll",
      {
        Reason: { cls: "reason", value: reason, md: true },
        Result: { cls: "result", value },
      },
      node,
    );
  }

  renderReroll(node: KdlNode) {
    if (!this.lastRoll) {
      return html`<p>No previous roll to reroll.</p>`;
    }

    const newScore = Math.min(
      +((node.properties.action ?? this.lastRoll.properties.action) as number) +
        +(this.lastRoll.properties.stat as number) +
        +((this.lastRoll.properties.adds as number) ?? 0),
      10,
    );
    const lastVs1 = +(this.lastRoll.properties.vs1 as number);
    const lastVs2 = +(this.lastRoll.properties.vs2 as number);
    const newVs1 = +((node.properties.vs1 ??
      this.lastRoll.properties.vs1) as number);
    const newVs2 = +((node.properties.vs2 ??
      this.lastRoll.properties.vs2) as number);
    const {
      cls: outcomeClass,
      text: outcome,
      match,
    } = rollOutcome(newScore, newVs1, newVs2);
    const def: DataList = {};
    if (node.properties.action != null) {
      const newAction = node.properties.action as number;
      const lastAction = this.lastRoll.properties.action as number;
      this.lastRoll.properties.action = newAction;
      def["Old action die"] = {
        cls: "action-die from",
        value: lastAction ?? 0,
      };
      def["New action die"] = { cls: "action-die to", value: newAction };
    }
    if (node.properties.vs1 != null) {
      const newVs1 = node.properties.vs1 as number;
      this.lastRoll.properties.vs1 = newVs1;
      def["Old challenge die 1"] = {
        cls: "challenge-die from vs1",
        value: lastVs1,
      };
      def["New challenge die 1"] = {
        cls: "challenge-die to vs1",
        value: newVs1,
      };
    }
    if (node.properties.vs2 != null) {
      const newVs2 = node.properties.vs2 as number;
      this.lastRoll.properties.vs2 = newVs2;
      def["Old challenge die 2"] = {
        cls: "challenge-die from vs2",
        value: lastVs2,
      };
      def["New challenge die 2"] = {
        cls: "challenge-die to vs2",
        value: newVs2,
      };
    }
    def["New score"] = { cls: "score", value: newScore };
    def["Challenge die 1"] = { cls: "challenge-die vs1", value: newVs1 };
    def["Challenge die 2"] = { cls: "challenge-die vs2", value: newVs2 };
    def["Outcome"] = { cls: "outcome", value: outcome, dataProp: false };
    this.setMoveHit(outcomeClass, match);
    return this.renderDlist("reroll " + outcomeClass, def, node);
  }

  renderAsset(node: KdlNode) {
    const assetName = (node.properties.name ?? node.values[0]) as string;
    const status = (node.properties.status ?? node.values[1]) as string;
    const ability = (node.properties.ability ?? node.values[2]) as
      | number
      | undefined;
    const dl: DataList = {
      Asset: { cls: "asset-name", value: assetName, md: true },
      Status: { cls: "asset-status", value: status },
    };
    if (ability) {
      dl.Ability = { cls: "asset-ability", value: ability };
    }
    return this.renderDlist("asset", dl, node);
  }

  renderImpact(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const marked = (node.properties.marked ?? node.values[1]) as boolean;
    return this.renderDlist(
      "impact",
      {
        Impact: { cls: "impact-name", value: name, md: true },
        Status: { cls: "impact-marked", value: "" + marked },
      },
      node,
    );
  }

  renderInitiative(node: KdlNode) {
    const from =
      ((node.properties.from ?? node.values[0]) as string) || "out-of-combat";
    const to =
      ((node.properties.to ?? node.values[1]) as string) || "out-of-combat";
    return this.renderDlist(
      "initiative",
      {
        From: {
          cls: "from " + initClass(from),
          value: initText(from),
        },
        To: {
          cls: "to " + initClass(to),
          value: initText(to),
        },
      },
      node,
    );
    function initClass(init: string) {
      return init.match(/bad.spot|no.initiative/i)
        ? "no-initiative"
        : init.match(/in.control|initiative/i)
          ? "has-initiative"
          : "out-of-combat";
    }
    function initText(init: string) {
      return init.match(/bad.spot/i)
        ? "In a bad spot"
        : init.match(/no.initiative/i)
          ? "No initiative"
          : init.match(/in.control/i)
            ? "In control"
            : init.match(/initiative/i)
              ? "Has initiative"
              : "Out of combat";
    }
  }

  renderActor(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    return html`<section
      class="actor"
      @contextmenu=${this.makeMenuHandler(node)}
    >
      <header>${md(this.plugin, name)}</header>
      <div ${ref((el) => makeSortable(el, node))}>
        ${this.renderChildren(node.children)}
      </div>
    </section>`;
  }

  renderDiceExpr(diceExprNode: MechanicsDiceExprNode, rawNode: KdlNode) {
    const parsed = tryParseDiceExpression(diceExprNode.properties.expr);

    const rolls = diceExprNode.children.flatMap((child) => {
      if (child.name === "rolls") {
        return [child.values];
      }
      return [];
    });

    const rendered = parsed.andThen((expr) =>
      tryOrElse(
        (e) => e,
        () => {
          const evaled = evaluateExpr(expr, (_expr, index) => rolls[index]);
          return toStringWithValues(evaled, false);
        },
      ),
    );

    return this.renderDlist(
      "dice-expr",
      {
        Expression: {
          cls: "expr",
          value: rendered.unwrapOr(diceExprNode.properties.expr),
          md: false,
        },
        Value: { cls: "value", value: diceExprNode.values[0], md: false },
      },
      rawNode,
    );
  }

  renderInvalid(node: KdlNode, error: Error) {
    return html`<p class="error" @contextmenu=${this.makeMenuHandler(node)}>
      Node "${node.name}" is invalid: ${error.message || "Unknown error"}
    </p>`;
  }

  renderUnknown(node: KdlNode) {
    return html`<p class="error" @contextmenu=${this.makeMenuHandler(node)}>
      Unknown node: "${node.name}"
    </p>`;
  }

  renderDlist(cls: string, data: DataList, node: KdlNode): TemplateResult {
    return html`<dl class=${cls} @contextmenu=${this.makeMenuHandler(node)}>
      ${repeat(
        Object.entries(data),
        ([key, { cls, value, dataProp, md: renderMd }]) => {
          return html`<dt>${key}</dt>
            <dd
              class=${cls}
              data-value=${dataProp !== false ? "" + value : undefined}
            >
              ${renderMd ? md(this.plugin, "" + value) : value}
            </dd>`;
        },
      )}
    </dl>`;
  }

  setMoveHit(hitKind: string, match: boolean) {
    const moveEl = this.moveEl;
    if (!moveEl) {
      return;
    }
    switch (hitKind.split(" ")[0]) {
      case "strong-hit": {
        moveEl.classList.toggle("strong-hit", true);
        moveEl.classList.toggle("weak-hit", false);
        moveEl.classList.toggle("miss", false);
        break;
      }
      case "weak-hit": {
        moveEl.classList.toggle("strong-hit", false);
        moveEl.classList.toggle("weak-hit", true);
        moveEl.classList.toggle("miss", false);
        break;
      }
      case "miss": {
        moveEl.classList.toggle("strong-hit", false);
        moveEl.classList.toggle("weak-hit", false);
        moveEl.classList.toggle("miss", true);
        break;
      }
    }
    moveEl.classList.toggle("match", match);
  }
}

type DataList = Record<string, DataDef>;

interface DataDef {
  cls: string;
  value: string | number | boolean | null;
  dataProp?: boolean;
  md?: boolean;
}

function rollOutcome(
  score: number,
  challenge1: number,
  challenge2: number,
): { cls: string; text: string; match: boolean } {
  let outcomeClass;
  let outcome;
  if (score > challenge1 && score > challenge2) {
    outcomeClass = "strong-hit";
    outcome = "Strong hit";
  } else if (score > challenge1 || score > challenge2) {
    outcomeClass = "weak-hit";
    outcome = "Weak hit";
  } else {
    outcomeClass = "miss";
    outcome = "Miss";
  }
  if (challenge1 === challenge2) {
    outcomeClass += " match";
    outcome += " (match)";
  }
  return {
    cls: outcomeClass,
    text: outcome,
    match: challenge1 === challenge2,
  };
}

interface SortableElement extends HTMLElement {
  node?: KdlNode;
}

// TODO(@zkat): Had to disable this because Obsidian doesn't seem to be
// updating the value of ctx.getSectionInfo properly, so if you move a
// node between two blocks, and back, the blocks will think they had
// their original ranges. Forcing a view rerender does not seem to force
// a block rerender.
//
// const MECH_BLOCK_GROUP = "mechanics-block-entries";
const makeSortable = (el: Element | undefined, node: KdlNode) => {
  if (el && Sortable.get(el as SortableElement)) {
    Sortable.get(el as SortableElement)!.destroy();
  }
  if (el) {
    (el as SortableElement).node = node;
    Sortable.create(el as SortableElement, {
      // group: MECH_BLOCK_GROUP,
      delay: 250,
      delayOnTouchOnly: true,
      animation: 150,
      swapThreshold: 0.65,
      onStart: (evt) => {
        const from = evt.from as SortableElement;
        const to = evt.to as SortableElement;
        if (!from.node || !to.node) {
          return;
        }
        const fromContent = from.closest(".iron-vault-mechanics")!;
        const toContent = to.closest(".iron-vault-mechanics")!;
        const fromRenderer = (
          fromContent.parentElement!.parentElement as MechanicsContainerEl
        ).mechanicsRenderer!;
        const toRenderer = (
          toContent.parentElement!.parentElement as MechanicsContainerEl
        ).mechanicsRenderer!;
        fromRenderer.activeMenu?.close();
        fromRenderer.activeMenu?.unload();
        if (fromRenderer !== toRenderer) {
          toRenderer.activeMenu?.close();
          toRenderer.activeMenu?.unload();
        }
      },
      onEnd: (evt) => {
        if (evt.oldIndex != null && evt.newIndex != null) {
          const from = evt.from as SortableElement;
          const to = evt.to as SortableElement;
          if (!from.node || !to.node) {
            return;
          }
          const fromContent = from.closest(".iron-vault-mechanics")!;
          const toContent = to.closest(".iron-vault-mechanics")!;
          const fromRenderer = (
            fromContent.parentElement!.parentElement as MechanicsContainerEl
          ).mechanicsRenderer!;
          const toRenderer = (
            toContent.parentElement!.parentElement as MechanicsContainerEl
          ).mechanicsRenderer!;
          to.node.children.splice(
            evt.newIndex,
            0,
            ...from.node.children.splice(evt.oldIndex, 1),
          );
          fromRenderer.fillParents(to.node!.children, to.node!);
          const lineOffset = fromRenderer.updateBlock();
          fromRenderer.update();
          if (fromRenderer !== toRenderer) {
            toRenderer.fillParents(from.node!.children, from.node!);
            const actualOffset =
              fromRenderer.containerEl.compareDocumentPosition(
                toRenderer.containerEl,
              ) & Node.DOCUMENT_POSITION_PRECEDING
                ? 0
                : lineOffset;
            toRenderer.updateBlock(actualOffset);
            toRenderer.update();
          }
        }
      },
    });
  }
};
