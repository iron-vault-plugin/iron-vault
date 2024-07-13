import { Node as KdlNodeBare, Document as KdlDocument, parse } from "kdljs";
import { ButtonComponent, MarkdownPostProcessorContext } from "obsidian";
import { render, html, TemplateResult } from "lit-html";
import { styleMap } from "lit-html/directives/style-map.js";
import { ref } from "lit-html/directives/ref.js";

import { ProgressTrack } from "tracks/progress";
import IronVaultPlugin from "../index";
import { md } from "utils/ui/directives";
import { map } from "lit-html/directives/map.js";

interface KdlNode extends KdlNodeBare {
  parent?: KdlNode;
}

function makeHandler(plugin: IronVaultPlugin) {
  return async (
    source: string,
    el: MechanicsContainerEl,
    ctx: MarkdownPostProcessorContext,
  ) => {
    // We can't render blocks until datastore is ready.
    await plugin.datastore.waitForReady;
    if (!el.mechanicsRenderer) {
      el.mechanicsRenderer = new MechanicsRenderer(
        el,
        source,
        plugin,
        ctx.sourcePath,
      );
    }
    el.mechanicsRenderer.render();
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

export class MechanicsRenderer {
  plugin: IronVaultPlugin;
  sourcePath: string;
  lastRoll: KdlNode | undefined;
  moveEl: HTMLElement | undefined;
  doc?: KdlDocument;
  details: string[] = [];
  contentEl: HTMLElement;
  source: string;
  mechNode?: HTMLElement;
  hideMechanics = false;

  constructor(
    contentEl: HTMLElement,
    source: string,
    plugin: IronVaultPlugin,
    sourcePath: string,
  ) {
    this.contentEl = contentEl;
    this.source = source;
    this.plugin = plugin;
    this.sourcePath = sourcePath;
    plugin.register(
      plugin.settings.on("change", ({ key, oldValue, newValue }) => {
        if (
          oldValue !== newValue &&
          (key === "showMechanicsToggle" ||
            key === "collapseMoves" ||
            key === "hideMechanics")
        ) {
          this.render();
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

  render() {
    if (this.plugin.settings.hideMechanics) {
      render(html``, this.contentEl);
      return;
    }
    const res = parse(this.source);
    if (!res.output) {
      // TODO: give line/column information for errors.
      render(
        html`<pre>
Error parsing mechanics block: KDL text was invalid.
See https://kdl.dev for syntax.</pre
        >`,
        this.contentEl,
      );
      return;
    }
    this.doc = res.output;
    this.fillParents(this.doc);
    render(
      html`<article
        ${(el?: Element) => (this.mechNode = el as HTMLElement | undefined)}
        class="iron-vault-mechanics"
        style=${styleMap({
          "--vs1-color": this.plugin.settings.challengeDie1Color,
          "--vs2-color": this.plugin.settings.challengeDie2Color,
        })}
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
              this.render();
            });
        })}
      >
        ${this.hideMechanics ? null : this.renderChildren(this.doc)}
      </article>`,
      this.contentEl,
    );
  }

  renderChildren(nodes: KdlNode[]): TemplateResult {
    return html`${map(
      nodes.reduce((acc, node) => {
        if (node.name === "-" && acc[acc.length - 1]?.name === "-") {
          acc[acc.length - 1].values.push(...node.values);
        } else {
          acc.push(node);
        }
        return acc;
      }, [] as KdlNode[]),
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
        // this.details.push(...(node.values[0] as string).split("\n"));
      }
      case "add": {
        return this.renderAdd(node);
      }
      case "roll": {
        this.lastRoll = node;
        this.lastRoll.properties.action =
          node.properties.action ?? node.values[1];
        this.lastRoll.properties.stat = node.properties.stat ?? node.values[2];
        this.lastRoll.properties.adds = node.properties.adds ?? node.values[3];
        this.lastRoll.properties.vs1 = node.properties.vs1 ?? node.values[4];
        this.lastRoll.properties.vs2 = node.properties.vs2 ?? node.values[5];
        return this.renderRoll(node);
        break;
      }
      case "progress-roll": {
        this.lastRoll = node;
        this.lastRoll.properties.score =
          node.properties.score ?? node.values[1];
        this.lastRoll.properties.vs1 = node.properties.vs1 ?? node.values[2];
        this.lastRoll.properties.vs2 = node.properties.vs2 ?? node.values[3];
        return this.renderProgressRoll(node);
        break;
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
        break;
      }
      case "asset": {
        return this.renderAsset(node);
      }
      case "impact": {
        return this.renderImpact(node);
        break;
      }
      case "initiative":
      case "position": {
        return this.renderInitiative(node);
      }
      case "actor": {
        return this.renderActor(node);
      }
      default: {
        return this.renderUnknown(node.name);
      }
    }
  }

  renderMove(node: KdlNode): TemplateResult {
    const moves = [...this.plugin.datastore.moves.values()];
    const id = node.properties.id as string | undefined;
    const name = (node.properties.name ?? node.values[0]) as string | undefined;
    const move = id
      ? moves.find((x) => x._id === id) ??
        moves.find((x) => x.name.toLowerCase() === name?.toLowerCase())
      : moves.find((x) => x.name.toLowerCase() === name?.toLowerCase());
    const moveName = name ?? move?.name ?? "Unknown move";
    return html`<details
      class="move"
      ?open=${!this.plugin.settings.collapseMoves}
      ${ref((el) => (this.moveEl = el as HTMLElement | undefined))}
    >
      <summary>${md(this.plugin, moveName)}</summary>
      ${this.renderChildren(node.children)}
    </details>`;
  }

  renderDetails(node: KdlNode) {
    const details = node.values.reduce((acc, val) => {
      if (typeof val === "string") {
        acc.push(...val.split("\n"));
      }
      return acc;
    }, [] as string[]);
    return html`<aside class="detail">
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
    return this.renderDlist("add", def);
  }

  renderMeter(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const from = (node.properties.from ?? node.values[1]) as number;
    const to = (node.properties.to ?? node.values[2]) as number;
    const delta = to - from;
    const neg = delta < 0;
    return this.renderDlist("meter", {
      Meter: { cls: "meter-name", value: name, md: true },
      Delta: {
        cls: "delta" + " " + (neg ? "negative" : "positive"),
        value: Math.abs(delta),
      },
      From: { cls: "from", value: from },
      To: { cls: "to", value: to },
    });
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
    return this.renderDlist(nodeCls, def);
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
    return this.renderDlist("progress", {
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
    });
  }

  renderTrack(node: KdlNode) {
    const trackName = (node.properties.name ?? node.values[0]) as string;
    const status = node.properties.status as string | undefined;
    if (status != null) {
      return this.renderDlist("track-status", {
        Track: { cls: "track-name", value: trackName, md: true },
        Status: { cls: "track-status", value: status },
      });
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
    return this.renderDlist("track", {
      "Track name": { cls: "track-name", value: trackName, md: true },
      "From boxes": { cls: "from-boxes", value: fromBoxes },
      "From ticks": { cls: "from-ticks", value: fromTicks },
      "To boxes": { cls: "to-boxes", value: toBoxes },
      "To ticks": { cls: "to-ticks", value: toTicks },
    });
  }

  renderXp(node: KdlNode) {
    const from = (node.properties.from ?? node.values[0]) as number;
    const to = (node.properties.to ?? node.values[1]) as number;
    const delta = to - from;
    const neg = delta < 0;
    return this.renderDlist("xp", {
      Delta: {
        cls: "delta" + " " + (neg ? "negative" : "positive"),
        value: Math.abs(delta),
      },
      From: { cls: "from", value: from },
      To: { cls: "to", value: to },
    });
  }

  renderClock(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const status = node.properties.status as string | undefined;
    if (status != null) {
      return this.renderDlist("clock-status", {
        Clock: { cls: "clock-name", value: name, md: true },
        Status: { cls: "clock-status", value: status },
      });
    }
    const from = (node.properties.from ?? node.values[1]) as number;
    const to = (node.properties.to ?? node.values[2]) as number;
    const outOf = (node.properties["out-of"] ?? node.values[3]) as number;
    return this.renderDlist("clock", {
      Clock: { cls: "clock-name", value: name, md: true },
      From: { cls: "from", value: from },
      "Out of from": { cls: "out-of", value: outOf },
      To: { cls: "to", value: to },
      "Out of to": { cls: "out-of", value: outOf },
    });
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
    return html`<div class="oracle-container">
      ${this.renderDlist("oracle", data)}
      ${node.children.length
        ? html`<blockquote>${this.renderChildren(node.children)}</blockquote>`
        : null}
    </div>`;
  }

  renderOracleGroup(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    return html`<article class="oracle-group">
      ${md(this.plugin, name)}
      ${node.children.length
        ? html`<blockquote>${this.renderChildren(node.children)}</blockquote>`
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
    return this.renderDlist("roll " + outcomeClass, def);
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
    return this.renderDlist("roll progress " + outcomeClass, {
      "Track name": { cls: "track-name", value: trackName, md: true },
      "Progress score": { cls: "progress-score", value: score },
      "Challenge die 1": { cls: "challenge-die vs1", value: challenge1 },
      "Challenge die 2": { cls: "challenge-die vs2", value: challenge2 },
      Outcome: { cls: "outcome", value: outcome, dataProp: false },
    });
  }

  renderDieRoll(node: KdlNode) {
    const reason = node.values[0] as string;
    const value = node.values[1] as number;
    return this.renderDlist("die-roll", {
      Reason: { cls: "reason", value: reason, md: true },
      Result: { cls: "result", value },
    });
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
    return this.renderDlist("reroll " + outcomeClass, def);
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
    return this.renderDlist("asset", dl);
  }

  renderImpact(node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const marked = (node.properties.marked ?? node.values[1]) as boolean;
    return this.renderDlist("impact", {
      Impact: { cls: "impact-name", value: name, md: true },
      Status: { cls: "impact-marked", value: "" + marked },
    });
  }

  renderInitiative(node: KdlNode) {
    const from =
      ((node.properties.from ?? node.values[0]) as string) || "out-of-combat";
    const to =
      ((node.properties.to ?? node.values[1]) as string) || "out-of-combat";
    return this.renderDlist("initiative", {
      From: {
        cls: "from " + initClass(from),
        value: initText(from),
      },
      To: {
        cls: "to " + initClass(to),
        value: initText(to),
      },
    });
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
    return html`<section class="actor">
      <header>${md(this.plugin, name)}</header>
      ${this.renderChildren(node.children)}
    </section>`;
  }

  renderUnknown(name: string) {
    return html`<p class="error">Unknown node: "${name}"</p>`;
  }

  renderDlist(cls: string, data: DataList): TemplateResult {
    return html`<dl class=${cls}>
      ${map(
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
