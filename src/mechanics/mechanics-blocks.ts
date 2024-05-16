import { parse, Node as KdlNode } from "kdljs";
import {
  App,
  ButtonComponent,
  MarkdownRenderChild,
  MarkdownRenderer,
  Modal,
} from "obsidian";
import { Move } from "@datasworn/core";

import ForgedPlugin from "../index";

export default function registerMechanicsBlock(plugin: ForgedPlugin): void {
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
  plugin: ForgedPlugin;
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
    plugin: ForgedPlugin,
    sourcePath: string,
  ) {
    this.contentEl = contentEl;
    this.source = source;
    this.plugin = plugin;
    this.sourcePath = sourcePath;
  }

  async render(): Promise<void> {
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
      cls: "forged-mechanics",
    });
    this.mechNode.classList.toggle("collapsed", this.hideMechanics);
    await this.renderChildren(this.mechNode, doc);
    await this.renderToggleButton();
  }

  async renderToggleButton() {
    if (!this.mechNode) {
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
        this.renderRoll(target, node);
        break;
      }
      case "progress-roll": {
        this.lastRoll = node;
        this.lastRoll.properties.score =
          node.properties.score ?? node.values[0];
        this.lastRoll.properties.vs1 = node.properties.vs1 ?? node.values[1];
        this.lastRoll.properties.vs2 = node.properties.vs2 ?? node.values[2];
        this.renderProgressRoll(target, node);
        break;
      }
      case "die-roll": {
        // TODO: actually style these.
        this.renderDieRoll(target, node);
        break;
      }
      case "reroll": {
        if (this.lastRoll) {
          this.renderReroll(target, node);
        }
        break;
      }
      case "meter": {
        this.renderMeter(target, node);
        break;
      }
      case "burn": {
        this.renderBurn(target, node);
        break;
      }
      case "progress": {
        this.renderProgress(target, node);
        break;
      }
      case "track": {
        this.renderTrack(target, node);
        break;
      }
      case "xp": {
        this.renderXp(target, node);
        break;
      }
      case "clock": {
        // TODO
        break;
      }
      case "oracle": {
        // TODO
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
    const moves = this.plugin.datastore.moves;
    const id = node.properties.id as string | undefined;
    const name = node.values[0] as string | undefined;
    const move = id
      ? moves.find((x) => x.id === id) ??
        moves.find((x) => x.name.toLowerCase() === name?.toLowerCase())
      : moves.find((x) => x.name.toLowerCase() === name?.toLowerCase());
    const moveName = name ?? move?.name;
    this.moveEl = target.createEl("details", { cls: "move" });
    const summary = this.moveEl.createEl("summary");
    if (moveName) {
      await this.renderMarkdown(summary, moveName);
      if (move) {
        const modal = new MoveModal(
          this.plugin.app,
          this.plugin,
          this.sourcePath,
          move,
        );
        const btn = new ButtonComponent(summary);
        btn
          .setButtonText("?")
          .setTooltip("View move text.")
          .onClick(() => modal.open());
      }
    }
    await this.renderChildren(this.moveEl, node.children, true);
  }

  async renderDetails(target: HTMLElement) {
    const aside = target.createEl("aside", { cls: "detail" });
    await this.renderMarkdown(aside, "> " + this.details.join("\n> "));
    this.details = [];
  }

  async renderAdd(target: HTMLElement, node: KdlNode) {
    // TODO: probably turn this into a dlist, too?
    const addEl = target.createEl("p", {
      cls: "add",
    });
    const text = `Add +${node.values[0]}${node.values[1] ? " (" + node.values[1] + ")" : ""}`;
    await this.renderMarkdown(addEl, text);
  }

  renderMeter(target: HTMLElement, node: KdlNode) {
    const name = node.values[0] as string;
    const from = (node.properties.from ?? node.values[1]) as number;
    const to = (node.properties.to ?? node.values[2]) as number;
    const delta = to - from;
    const neg = delta < 0;
    this.renderDlist(target, "meter", {
      Meter: { cls: "meter-name", value: name },
      Delta: {
        cls: "delta" + " " + (neg ? "negative" : "positive"),
        value: Math.abs(delta),
      },
      From: { cls: "from", value: from },
      To: { cls: "to", value: to },
    });
  }

  renderBurn(target: HTMLElement, node: KdlNode) {
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
    this.renderDlist(target, nodeCls, def);
  }

  renderProgress(target: HTMLElement, node: KdlNode) {
    const trackName = node.values[0] as string;
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
    const level = (node.properties.level ?? node.values[2]) as string;
    const steps = (node.properties.steps ?? node.values[3] ?? 1) as number;
    const delta = levelTicks(level) * steps;
    const to = from + delta;
    const toBoxes = Math.floor(to / 4);
    const toTicks = to % 4;
    this.renderDlist(target, "progress", {
      "Track Name": { cls: "track-name", value: trackName },
      Steps: {
        cls: "steps " + (steps < 0 ? "negative" : "positive"),
        value: steps,
      },
      Level: { cls: "level", value: level },
      "From Boxes": { cls: "from-boxes", value: fromBoxes },
      "From Ticks": { cls: "from-ticks", value: fromTicks },
      "To Boxes": { cls: "to-boxes", value: toBoxes },
      "To Ticks": { cls: "to-ticks", value: toTicks },
    });
  }

  renderTrack(target: HTMLElement, node: KdlNode) {
    const trackName = node.values[0] as string;
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
    this.renderDlist(target, "track", {
      "Track Name": { cls: "track-name", value: trackName },
      "From Boxes": { cls: "from-boxes", value: fromBoxes },
      "From Ticks": { cls: "from-ticks", value: fromTicks },
      "To Boxes": { cls: "to-boxes", value: toBoxes },
      "To Ticks": { cls: "to-ticks", value: toTicks },
    });
  }

  renderXp(target: HTMLElement, node: KdlNode) {
    const from = (node.properties.from ?? node.values[0]) as number;
    const to = (node.properties.to ?? node.values[1]) as number;
    const delta = to - from;
    const neg = delta < 0;
    this.renderDlist(target, "xp", {
      Delta: {
        cls: "delta" + " " + (neg ? "negative" : "positive"),
        value: Math.abs(delta),
      },
      From: { cls: "from", value: from },
      To: { cls: "to", value: to },
    });
  }

  renderRoll(target: HTMLElement, node: KdlNode) {
    const statName = node.values[0] as string;
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
    this.renderDlist(target, "roll " + outcomeClass, def);
  }

  renderProgressRoll(target: HTMLElement, node: KdlNode) {
    const score = (node.properties.score ?? node.values[0]) as number;
    const challenge1 = (node.properties.vs1 ?? node.values[1]) as number;
    const challenge2 = (node.properties.vs2 ?? node.values[2]) as number;
    const {
      cls: outcomeClass,
      text: outcome,
      match,
    } = rollOutcome(score, challenge1, challenge2);
    this.setMoveHit(outcomeClass, match);
    this.renderDlist(target, "roll progress " + outcomeClass, {
      "Progress Score": { cls: "progress-score", value: score },
      "Challenge Die 1": { cls: "challenge-die", value: challenge1 },
      "Challenge Die 2": { cls: "challenge-die", value: challenge2 },
      Outcome: { cls: "outcome", value: outcome, dataProp: false },
    });
  }

  renderDieRoll(target: HTMLElement, node: KdlNode) {
    const reason = node.values[0] as string;
    const value = node.values[1] as number;
    this.renderDlist(target, "die-roll", {
      [reason]: { cls: "die", value },
    });
  }

  renderReroll(target: HTMLElement, node: KdlNode) {
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
    this.renderDlist(target, "reroll " + outcomeClass, def);
  }

  renderUnknown(target: HTMLElement, name: string) {
    target.createEl("p", {
      text: `Unknown move node: "${name}"`,
      cls: "error",
    });
  }

  async renderDlist(target: HTMLElement, cls: string, data: DataList) {
    const dl = target.createEl("dl", { cls });
    for (const [key, { cls, value, dataProp }] of Object.entries(data)) {
      dl.createEl("dt", {
        text: key,
      });
      const dd = dl.createEl("dd", {
        cls,
        text: "" + value,
      });
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

enum Level {
  Troublesome = 12,
  Dangerous = 8,
  Formidable = 4,
  Extreme = 2,
  Epic = 1,
}

function levelTicks(level: string): number {
  switch (level.toLowerCase()) {
    case "troublesome":
      return Level.Troublesome;
    case "dangerous":
      return Level.Dangerous;
    case "formidable":
      return Level.Formidable;
    case "extreme":
      return Level.Extreme;
    case "epic":
      return Level.Epic;
    default:
      return 0;
  }
}

export class MoveModal extends Modal {
  plugin: ForgedPlugin;
  move: Move;
  sourcePath: string;

  constructor(app: App, plugin: ForgedPlugin, sourcePath: string, move: Move) {
    super(app);
    this.plugin = plugin;
    this.move = move;
    this.sourcePath = sourcePath;
  }

  openMove(move: Move) {
    const { contentEl } = this;
    (async () => {
      await MarkdownRenderer.render(
        this.app,
        `# ${move.name}\n${move.text}`,
        contentEl,
        this.sourcePath,
        this.plugin,
      );
      for (const child of contentEl.querySelectorAll('a[href^="id:"]')) {
        child.addEventListener("click", (ev) => {
          const id = child.getAttribute("href")?.slice(3);
          ev.preventDefault();
          const move = this.plugin.datastore.moves.find(
            (move) => move.id === id,
          );
          if (move) {
            contentEl.empty();
            this.openMove(move);
          }
        });
      }
    })();
  }

  onOpen() {
    this.openMove(this.move);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
