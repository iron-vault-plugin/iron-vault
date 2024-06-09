import { Node as KdlNode, parse } from "kdljs";
import {
  ButtonComponent,
  MarkdownRenderChild,
  MarkdownRenderer,
} from "obsidian";

import { ProgressTrack } from "tracks/progress";
import IronVaultPlugin from "../index";

export default function registerMechanicsBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "mechanics",
    async (source, el: MechanicsContainerEl, ctx) => {
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
      await el.mechanicsRenderer.render();
    },
  );
}

interface MechanicsContainerEl extends HTMLElement {
  mechanicsRenderer?: MechanicsRenderer;
}

export class MechanicsRenderer {
  plugin: IronVaultPlugin;
  sourcePath: string;
  lastRoll: KdlNode | undefined;
  moveEl: HTMLElement | undefined;
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

  async render(): Promise<void> {
    this.contentEl.empty();
    if (this.plugin.settings.hideMechanics) {
      return;
    }
    const res = parse(this.source);
    if (!res.output) {
      // TODO: give line/column information for errors.
      this.contentEl.createEl("pre", {
        text: `Error parsing mechanics block: KDL text was invalid.\nSee https://kdl.dev for syntax.`,
      });
      return;
    }
    const doc = res.output;
    this.mechNode = this.contentEl.createEl("article", {
      cls: "iron-vault-mechanics",
    });
    this.mechNode.classList.toggle("collapsed", this.hideMechanics);
    await this.renderChildren(this.mechNode, doc);
    await this.renderToggleButton();
  }

  async renderToggleButton() {
    if (!this.mechNode || !this.plugin.settings.showMechanicsToggle) {
      return;
    }
    const btn = new ButtonComponent(this.mechNode);
    btn
      .setButtonText("Hide Mechanics")
      .setClass("toggle")
      .setTooltip("Toggle displaying mechanics")
      .onClick(() => {
        this.hideMechanics = !this.hideMechanics;
        this.mechNode?.classList.toggle("collapsed", this.hideMechanics);
        btn.setButtonText(
          this.hideMechanics ? "Show Mechanics" : "Hide Mechanics",
        );
      });
  }

  async renderChildren(
    target: HTMLElement,
    nodes: KdlNode[],
    keepMoveEl = false,
  ): Promise<void> {
    for (const node of nodes) {
      const name = node.name.toLowerCase();
      if (this.details.length && name !== "-") {
        await this.renderDetails(target);
      }
      if (this.moveEl && !keepMoveEl) {
        this.moveEl = undefined;
      }
      await this.renderNode(target, node);
    }
    if (this.details.length) {
      await this.renderDetails(target);
    }
  }

  async renderNode(target: HTMLElement, node: KdlNode): Promise<void> {
    if (this.details.length && node.name !== "-") {
      await this.renderDetails(target);
    }
    switch (node.name.toLowerCase()) {
      case "move": {
        await this.renderMove(target, node);
        break;
      }
      case "-": {
        this.details.push(...(node.values[0] as string).split("\n"));
        break;
      }
      case "add": {
        await this.renderAdd(target, node);
        break;
      }
      case "roll": {
        this.lastRoll = node;
        this.lastRoll.properties.action =
          node.properties.action ?? node.values[1];
        this.lastRoll.properties.stat = node.properties.stat ?? node.values[2];
        this.lastRoll.properties.adds = node.properties.adds ?? node.values[3];
        this.lastRoll.properties.vs1 = node.properties.vs1 ?? node.values[4];
        this.lastRoll.properties.vs2 = node.properties.vs2 ?? node.values[5];
        await this.renderRoll(target, node);
        break;
      }
      case "progress-roll": {
        this.lastRoll = node;
        this.lastRoll.properties.score =
          node.properties.score ?? node.values[1];
        this.lastRoll.properties.vs1 = node.properties.vs1 ?? node.values[2];
        this.lastRoll.properties.vs2 = node.properties.vs2 ?? node.values[3];
        await this.renderProgressRoll(target, node);
        break;
      }
      case "die-roll": {
        // TODO: actually style these.
        await this.renderDieRoll(target, node);
        break;
      }
      case "reroll": {
        await this.renderReroll(target, node);
        break;
      }
      case "meter": {
        await this.renderMeter(target, node);
        break;
      }
      case "burn": {
        await this.renderBurn(target, node);
        break;
      }
      case "progress": {
        await this.renderProgress(target, node);
        break;
      }
      case "track": {
        await this.renderTrack(target, node);
        break;
      }
      case "xp": {
        await this.renderXp(target, node);
        break;
      }
      case "clock": {
        await this.renderClock(target, node);
        break;
      }
      case "oracle": {
        await this.renderOracle(target, node);
        break;
      }
      case "oracle-group": {
        await this.renderOracleGroup(target, node);
        break;
      }
      case "asset": {
        await this.renderAsset(target, node);
        break;
      }
      case "impact": {
        await this.renderImpact(target, node);
        break;
      }
      default: {
        this.renderUnknown(target, node.name);
      }
    }
  }

  async renderMarkdown(target: HTMLElement, md: string) {
    await MarkdownRenderer.render(
      this.plugin.app,
      md,
      target,
      this.sourcePath,
      new MarkdownRenderChild(target),
    );
  }

  async renderMove(target: HTMLElement, node: KdlNode) {
    const moves = [...this.plugin.datastore.moves.values()];
    const id = node.properties.id as string | undefined;
    const name = (node.properties.name ?? node.values[0]) as string | undefined;
    const move = id
      ? moves.find((x) => x._id === id) ??
        moves.find((x) => x.name.toLowerCase() === name?.toLowerCase())
      : moves.find((x) => x.name.toLowerCase() === name?.toLowerCase());
    const moveName = name ?? move?.name;
    this.moveEl = target.createEl("details", { cls: "move" });
    if (!this.plugin.settings.collapseMoves) {
      this.moveEl.setAttribute("open", "open");
    }
    const summary = this.moveEl.createEl("summary");
    if (moveName) {
      await this.renderMarkdown(summary, moveName);
    }
    await this.renderChildren(this.moveEl, node.children, true);
  }

  async renderDetails(target: HTMLElement) {
    const aside = target.createEl("aside", { cls: "detail" });
    await this.renderMarkdown(aside, "> " + this.details.join("\n> "));
    this.details = [];
  }

  async renderAdd(target: HTMLElement, node: KdlNode) {
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
    await this.renderDlist(target, "add", def);
  }

  async renderMeter(target: HTMLElement, node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const from = (node.properties.from ?? node.values[1]) as number;
    const to = (node.properties.to ?? node.values[2]) as number;
    const delta = to - from;
    const neg = delta < 0;
    await this.renderDlist(target, "meter", {
      Meter: { cls: "meter-name", value: name, md: true },
      Delta: {
        cls: "delta" + " " + (neg ? "negative" : "positive"),
        value: Math.abs(delta),
      },
      From: { cls: "from", value: from },
      To: { cls: "to", value: to },
    });
  }

  async renderBurn(target: HTMLElement, node: KdlNode) {
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
      target.createEl("p", {
        text: "Can't burn momentum on progress rolls.",
        cls: "error",
      });
      return;
    } else if (this.lastRoll) {
      const vs1 = this.lastRoll.properties.vs1 as number;
      const vs2 = this.lastRoll.properties.vs2 as number;
      def["New Score"] = { cls: "score", value: from };
      def["Challenge Die 1"] = {
        cls: "challenge-die",
        value: vs1,
      };
      def["Challenge Die 2"] = {
        cls: "challenge-die",
        value: vs2,
      };
      const { cls, text, match } = rollOutcome(from, vs1, vs2);
      this.setMoveHit(cls, match);
      def["Outcome"] = { cls: "outcome", value: text, dataProp: false };
      nodeCls += " " + cls;
    }
    await this.renderDlist(target, nodeCls, def);
  }

  async renderProgress(target: HTMLElement, node: KdlNode) {
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
      target.createEl("pre", {
        text: `Invalid track:\n${result.error.toString()}`,
        cls: "error",
      });
      return;
    }
    const startTrack = result.value;

    const [fromBoxes, fromTicks] = startTrack.boxesAndTicks();
    const rank = startTrack.rank;
    const steps = (node.properties.steps ?? node.values[3] ?? 1) as number;

    const endTrack = startTrack.advanced(steps);
    const [toBoxes, toTicks] = endTrack.boxesAndTicks();
    await this.renderDlist(target, "progress", {
      "Track Name": { cls: "track-name", value: trackName, md: true },
      Steps: {
        cls: "steps " + (steps < 0 ? "negative" : "positive"),
        value: steps,
      },
      Rank: { cls: "rank", value: rank },
      "From Boxes": { cls: "from-boxes", value: fromBoxes },
      "From Ticks": { cls: "from-ticks", value: fromTicks },
      "To Boxes": { cls: "to-boxes", value: toBoxes },
      "To Ticks": { cls: "to-ticks", value: toTicks },
    });
  }

  async renderTrack(target: HTMLElement, node: KdlNode) {
    const trackName = (node.properties.name ?? node.values[0]) as string;
    const status = node.properties.status as string | undefined;
    if (status != null) {
      await this.renderDlist(target, "track-status", {
        Track: { cls: "track-name", value: trackName, md: true },
        Status: { cls: "track-status", value: status },
      });
      return;
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
    await this.renderDlist(target, "track", {
      "Track Name": { cls: "track-name", value: trackName, md: true },
      "From Boxes": { cls: "from-boxes", value: fromBoxes },
      "From Ticks": { cls: "from-ticks", value: fromTicks },
      "To Boxes": { cls: "to-boxes", value: toBoxes },
      "To Ticks": { cls: "to-ticks", value: toTicks },
    });
  }

  async renderXp(target: HTMLElement, node: KdlNode) {
    const from = (node.properties.from ?? node.values[0]) as number;
    const to = (node.properties.to ?? node.values[1]) as number;
    const delta = to - from;
    const neg = delta < 0;
    await this.renderDlist(target, "xp", {
      Delta: {
        cls: "delta" + " " + (neg ? "negative" : "positive"),
        value: Math.abs(delta),
      },
      From: { cls: "from", value: from },
      To: { cls: "to", value: to },
    });
  }

  async renderClock(target: HTMLElement, node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const status = node.properties.status as string | undefined;
    if (status != null) {
      await this.renderDlist(target, "clock-status", {
        Clock: { cls: "clock-name", value: name, md: true },
        Status: { cls: "clock-status", value: status },
      });
      return;
    }
    const from = (node.properties.from ?? node.values[1]) as number;
    const to = (node.properties.to ?? node.values[2]) as number;
    const outOf = (node.properties["out-of"] ?? node.values[3]) as number;
    await this.renderDlist(target, "clock", {
      Clock: { cls: "clock-name", value: name, md: true },
      From: { cls: "from", value: from },
      OutOfFrom: { cls: "out-of", value: outOf },
      To: { cls: "to", value: to },
      OutOfTo: { cls: "out-of", value: outOf },
    });
  }

  async renderOracle(target: HTMLElement, node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const roll = (node.properties.roll ?? node.values[1]) as number;
    const result = (node.properties.result ?? node.values[2]) as string;
    const wrapper = target.createDiv("oracle-container");
    await this.renderDlist(wrapper, "oracle", {
      name: { cls: "name", value: name, md: true },
      roll: { cls: "roll", value: roll },
      result: { cls: "result", value: result, md: true },
    });
    if (node.children.length) {
      const bq = wrapper.createEl("blockquote");
      for (const child of node.children) {
        await this.renderNode(bq, child);
      }
    }
  }

  async renderOracleGroup(target: HTMLElement, node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const wrapper = target.createEl("article", { cls: "oracle-group" });
    await this.renderMarkdown(wrapper, name);
    if (node.children.length) {
      const bq = wrapper.createEl("blockquote");
      for (const child of node.children) {
        await this.renderNode(bq, child);
      }
    }
  }

  async renderRoll(target: HTMLElement, node: KdlNode) {
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
      "Action Die": { cls: "action-die", value: action },
      Stat: { cls: "stat", value: stat },
    };
    if (statName) {
      def["Stat Name"] = { cls: "stat-name", value: statName };
    }
    Object.assign(def, {
      Adds: { cls: "adds", value: adds },
      Score: { cls: "score", value: score },
      "Challenge Die 1": { cls: "challenge-die", value: challenge1 },
      "Challenge Die 2": { cls: "challenge-die", value: challenge2 },
      Outcome: { cls: "outcome", value: outcome, dataProp: false },
    });
    await this.renderDlist(target, "roll " + outcomeClass, def);
  }

  async renderProgressRoll(target: HTMLElement, node: KdlNode) {
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
    await this.renderDlist(target, "roll progress " + outcomeClass, {
      "Track Name": { cls: "track-name", value: trackName, md: true },
      "Progress Score": { cls: "progress-score", value: score },
      "Challenge Die 1": { cls: "challenge-die", value: challenge1 },
      "Challenge Die 2": { cls: "challenge-die", value: challenge2 },
      Outcome: { cls: "outcome", value: outcome, dataProp: false },
    });
  }

  async renderDieRoll(target: HTMLElement, node: KdlNode) {
    const reason = node.values[0] as string;
    const value = node.values[1] as number;
    await this.renderDlist(target, "die-roll", {
      Reason: { cls: "reason", value: reason, md: true },
      Result: { cls: "result", value },
    });
  }

  async renderReroll(target: HTMLElement, node: KdlNode) {
    if (!this.lastRoll) {
      target.createEl("p", {
        text: "No previous roll to reroll.",
        cls: "error",
      });
      return;
    }

    const newScore = Math.min(
      ((node.properties.action ?? this.lastRoll.properties.action) as number) +
        (this.lastRoll.properties.stat as number) +
        ((this.lastRoll.properties.adds as number) ?? 0),
      10,
    );
    const lastVs1 = this.lastRoll.properties.vs1 as number;
    const lastVs2 = this.lastRoll.properties.vs2 as number;
    const newVs1 = (node.properties.vs1 ??
      this.lastRoll.properties.vs1) as number;
    const newVs2 = (node.properties.vs2 ??
      this.lastRoll.properties.vs2) as number;
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
      def["Old Action Die"] = {
        cls: "action-die from",
        value: lastAction ?? 0,
      };
      def["New Action Die"] = { cls: "action-die to", value: newAction };
    }
    if (node.properties.vs1 != null) {
      const newVs1 = node.properties.vs1 as number;
      this.lastRoll.properties.vs1 = newVs1;
      def["Old Challenge Die 1"] = {
        cls: "challenge-die from",
        value: lastVs1,
      };
      def["New Challenge Die 1"] = { cls: "challenge-die to", value: newVs1 };
    }
    if (node.properties.vs2 != null) {
      const newVs2 = node.properties.vs2 as number;
      this.lastRoll.properties.vs2 = newVs2;
      def["Old Challenge Die 2"] = {
        cls: "challenge-die from",
        value: lastVs2,
      };
      def["New Challenge Die 2"] = { cls: "challenge-die to", value: newVs2 };
    }
    def["New Score"] = { cls: "score", value: newScore };
    def["Challenge Die 1"] = { cls: "challenge-die", value: newVs1 };
    def["Challenge Die 2"] = { cls: "challenge-die", value: newVs2 };
    def["Outcome"] = { cls: "outcome", value: outcome, dataProp: false };
    this.setMoveHit(outcomeClass, match);
    await this.renderDlist(target, "reroll " + outcomeClass, def);
  }

  async renderAsset(target: HTMLElement, node: KdlNode) {
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
    await this.renderDlist(target, "asset", dl);
    return;
  }

  async renderImpact(target: HTMLElement, node: KdlNode) {
    const name = (node.properties.name ?? node.values[0]) as string;
    const marked = (node.properties.marked ?? node.values[1]) as boolean;
    await this.renderDlist(target, "impact", {
      Impact: { cls: "impact-name", value: name, md: true },
      Status: { cls: "impact-marked", value: "" + marked },
    });
  }

  renderUnknown(target: HTMLElement, name: string) {
    target.createEl("p", {
      text: `Unknown move node: "${name}"`,
      cls: "error",
    });
  }

  async renderDlist(target: HTMLElement, cls: string, data: DataList) {
    const dl = target.createEl("dl", { cls });
    for (const [key, { cls, value, dataProp, md }] of Object.entries(data)) {
      dl.createEl("dt", {
        text: key,
      });
      let dd;
      if (md) {
        dd = dl.createEl("dd", {
          cls,
        });
        await this.renderMarkdown(dd, value as string);
      } else {
        dd = dl.createEl("dd", {
          cls,
          text: "" + value,
        });
      }
      if (dataProp !== false) {
        dd.setAttribute("data-value", "" + value);
      }
    }
    return dl;
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
    outcome = "Strong Hit";
  } else if (score > challenge1 || score > challenge2) {
    outcomeClass = "weak-hit";
    outcome = "Weak Hit";
  } else {
    outcomeClass = "miss";
    outcome = "Miss";
  }
  if (challenge1 === challenge2) {
    outcomeClass += " match";
    outcome += " (Match)";
  }
  return {
    cls: outcomeClass,
    text: outcome,
    match: challenge1 === challenge2,
  };
}
