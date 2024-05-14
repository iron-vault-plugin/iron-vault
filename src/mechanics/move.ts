import { Move } from "@datasworn/core";
import ForgedPlugin from "index";
import { Node as KdlNode } from "kdljs";
import {
  App,
  ButtonComponent,
  MarkdownRenderChild,
  MarkdownRenderer,
  Modal,
} from "obsidian";

export default async function renderMove(
  plugin: ForgedPlugin,
  el: HTMLElement,
  node: KdlNode,
  sourcePath: string,
) {
  const moves = plugin.datastore.moves;
  const id = node.properties.id as string | undefined;
  const name = node.values[0] as string | undefined;
  const move = id
    ? moves.find((x) => x.id === id) ??
      moves.find((x) => x.name.toLowerCase() === name?.toLowerCase())
    : moves.find((x) => x.name.toLowerCase() === name?.toLowerCase());
  const moveName = name ?? move?.name;
  const moveNode = el.createEl("details", { cls: "forged-move" });
  const summary = moveNode.createEl("summary");
  if (moveName) {
    await renderMarkdown(summary, moveName);
    if (move) {
      const modal = new MoveModal(plugin.app, plugin, sourcePath, move);
      const btn = new ButtonComponent(summary);
      btn
        .setButtonText("?")
        .setTooltip("View move text.")
        .onClick(() => modal.open());
    }
  }
  let lastRoll = undefined;
  for (const item of node.children) {
    const name = item.name.toLowerCase();
    switch (name) {
      case "-": {
        await renderDetail(moveNode, item, renderMarkdown);
        break;
      }
      case "add": {
        await renderAdd(moveNode, item, renderMarkdown);
        break;
      }
      case "roll": {
        lastRoll = item;
        lastRoll.properties.action = item.properties.action ?? item.values[1];
        lastRoll.properties.stat = item.properties.stat ?? item.values[2];
        lastRoll.properties.adds = item.properties.adds ?? item.values[3];
        lastRoll.properties.vs1 = item.properties.vs1 ?? item.values[4];
        lastRoll.properties.vs2 = item.properties.vs2 ?? item.values[5];
        renderRoll(moveNode, item);
        break;
      }
      case "progress-roll": {
        lastRoll = item;
        lastRoll.properties.score = item.properties.score ?? item.values[0];
        lastRoll.properties.vs1 = item.properties.vs1 ?? item.values[1];
        lastRoll.properties.vs2 = item.properties.vs2 ?? item.values[2];
        renderProgress(moveNode, item);
        break;
      }
      case "die-roll": {
        // TODO: actually style these.
        renderDieRoll(moveNode, item);
        break;
      }
      case "reroll": {
        if (lastRoll) {
          renderReroll(moveNode, item, lastRoll);
        }
        break;
      }
      case "meter": {
        renderMeter(moveNode, item);
        break;
      }
      case "burn": {
        renderBurn(moveNode, item, lastRoll);
        break;
      }
      case "clock": {
        // TODO
        break;
      }
      case "progress": {
        // TODO
        break;
      }
      case "oracle": {
        // TODO
        break;
      }
      default: {
        renderUnknown(moveNode, name);
      }
    }
  }
  async function renderMarkdown(el: HTMLElement, md: string) {
    await MarkdownRenderer.render(
      plugin.app,
      md,
      el,
      sourcePath,
      new MarkdownRenderChild(el),
    );
  }
}

// --- Renderers ---

async function renderDetail(
  moveNode: HTMLElement,
  item: KdlNode,
  renderMarkdown: (el: HTMLElement, md: string) => Promise<void>,
) {
  const detailNode = moveNode.createEl("p", {
    cls: "detail",
  });
  await renderMarkdown(
    detailNode,
    (item.values[0] as string).replaceAll(/^/g, "> "),
  );
}

async function renderAdd(
  moveNode: HTMLElement,
  add: KdlNode,
  renderMarkdown: (el: HTMLElement, md: string) => Promise<void>,
) {
  // TODO: probably turn this into a dlist, too?
  const addNode = moveNode.createEl("p", {
    cls: "add",
  });
  const text = `Add +${add.values[0]}${add.values[1] ? " (" + add.values[1] + ")" : ""}`;
  await renderMarkdown(addNode, text);
}

function renderMeter(moveNode: HTMLElement, meter: KdlNode) {
  const name = meter.values[0] as string;
  const from = (meter.properties.from ?? meter.values[1]) as number;
  const to = (meter.properties.to ?? meter.values[2]) as number;
  const delta = to - from;
  const neg = delta < 0;
  renderDlist(moveNode, "meter", {
    Meter: { cls: "meter-name", value: name },
    Delta: {
      cls: "delta" + " " + (neg ? "negative" : "positive"),
      value: Math.abs(delta),
    },
    From: { cls: "from", value: from },
    To: { cls: "to", value: to },
  });
}

function renderBurn(
  moveNode: HTMLElement,
  burn: KdlNode,
  lastRoll: KdlNode | undefined,
) {
  const from = Math.max(
    -6,
    Math.min((burn.properties.from ?? burn.values[0]) as number, 10),
  );
  const to = Math.max(
    -6,
    Math.min((burn.properties.to ?? burn.values[1]) as number, 10),
  );
  const def: DataList = {
    From: { cls: "from", value: from },
    To: { cls: "to", value: to },
  };
  let nodeCls = "burn";
  if (lastRoll && lastRoll.name === "progress-roll") {
    moveNode.createEl("p", {
      text: "Can't burn momentum on progress rolls.",
      cls: "error",
    });
    return;
  } else if (lastRoll) {
    const vs1 = lastRoll.properties.vs1 as number;
    const vs2 = lastRoll.properties.vs2 as number;
    def["New Score"] = { cls: "score", value: from };
    def["Challenge Die 1"] = {
      cls: "challenge-die",
      value: vs1,
    };
    def["Challenge Die 2"] = {
      cls: "challenge-die",
      value: vs2,
    };
    const { cls, text, match } = moveOutcome(from, vs1, vs2);
    setMoveHit(moveNode, cls, match);
    def["Outcome"] = { cls: "outcome", value: text, dataProp: false };
    nodeCls += " " + cls;
  }
  renderDlist(moveNode, nodeCls, def);
}

function renderRoll(moveNode: HTMLElement, roll: KdlNode) {
  const statName = roll.values[0] as string;
  const action = (roll.properties.action ?? roll.values[1]) as number;
  const stat = (roll.properties.stat ?? roll.values[2]) as number;
  const adds = (roll.properties.adds ?? roll.values[3] ?? 0) as number;
  const score = Math.min(10, action + stat + adds);
  const challenge1 = (roll.properties.vs1 ?? roll.values[4]) as number;
  const challenge2 = (roll.properties.vs2 ?? roll.values[5]) as number;
  const {
    cls: outcomeClass,
    text: outcome,
    match,
  } = moveOutcome(score, challenge1, challenge2);
  setMoveHit(moveNode, outcomeClass, match);
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
  renderDlist(moveNode, "roll " + outcomeClass, def);
}

function renderProgress(moveNode: HTMLElement, roll: KdlNode) {
  const score = (roll.properties.score ?? roll.values[0]) as number;
  const challenge1 = (roll.properties.vs1 ?? roll.values[1]) as number;
  const challenge2 = (roll.properties.vs2 ?? roll.values[2]) as number;
  const {
    cls: outcomeClass,
    text: outcome,
    match,
  } = moveOutcome(score, challenge1, challenge2);
  setMoveHit(moveNode, outcomeClass, match);
  renderDlist(moveNode, "roll progress " + outcomeClass, {
    "Progress Score": { cls: "progress-score", value: score },
    "Challenge Die 1": { cls: "challenge-die", value: challenge1 },
    "Challenge Die 2": { cls: "challenge-die", value: challenge2 },
    Outcome: { cls: "outcome", value: outcome, dataProp: false },
  });
}

function renderDieRoll(moveNode: HTMLElement, roll: KdlNode) {
  const reason = roll.values[0] as string;
  const value = roll.values[1] as number;
  renderDlist(moveNode, "die-roll", {
    [reason]: { cls: "die", value },
  });
}

function renderReroll(moveNode: HTMLElement, roll: KdlNode, lastRoll: KdlNode) {
  const newScore = Math.min(
    ((roll.properties.action ?? lastRoll.properties.action) as number) +
      (lastRoll.properties.stat as number) +
      ((lastRoll.properties.adds as number) ?? 0),
    10,
  );
  const lastVs1 = lastRoll.properties.vs1 as number;
  const lastVs2 = lastRoll.properties.vs2 as number;
  const newVs1 = (roll.properties.vs1 ?? lastRoll.properties.vs1) as number;
  const newVs2 = (roll.properties.vs2 ?? lastRoll.properties.vs2) as number;
  const {
    cls: outcomeClass,
    text: outcome,
    match,
  } = moveOutcome(newScore, newVs1, newVs2);
  const def: DataList = {};
  if (roll.properties.action != null) {
    const newAction = roll.properties.action as number;
    const lastAction = lastRoll.properties.action as number;
    lastRoll.properties.action = newAction;
    def["Old Action Die"] = { cls: "action-die from", value: lastAction ?? 0 };
    def["New Action Die"] = { cls: "action-die to", value: newAction };
  }
  if (roll.properties.vs1 != null) {
    const newVs1 = roll.properties.vs1 as number;
    lastRoll.properties.vs1 = newVs1;
    def["Old Challenge Die 1"] = { cls: "challenge-die from", value: lastVs1 };
    def["New Challenge Die 1"] = { cls: "challenge-die to", value: newVs1 };
  }
  if (roll.properties.vs2 != null) {
    const newVs2 = roll.properties.vs2 as number;
    lastRoll.properties.vs2 = newVs2;
    def["Old Challenge Die 2"] = { cls: "challenge-die from", value: lastVs2 };
    def["New Challenge Die 2"] = { cls: "challenge-die to", value: newVs2 };
  }
  def["New Score"] = { cls: "score", value: newScore };
  def["Challenge Die 1"] = { cls: "challenge-die", value: newVs1 };
  def["Challenge Die 2"] = { cls: "challenge-die", value: newVs2 };
  def["Outcome"] = { cls: "outcome", value: outcome, dataProp: false };
  setMoveHit(moveNode, outcomeClass, match);
  renderDlist(moveNode, "reroll " + outcomeClass, def);
}

function renderUnknown(moveNode: HTMLElement, name: string) {
  moveNode.createEl("p", {
    text: `Unknown move node: "${name}"`,
    cls: "error",
  });
}

// --- Util ---

type DataList = Record<string, DataDef>;

interface DataDef {
  cls: string;
  value: string | number | boolean | null;
  dataProp?: boolean;
}

function renderDlist(el: HTMLElement, cls: string, data: DataList) {
  const dl = el.createEl("dl", { cls });
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

function setMoveHit(moveEl: HTMLElement, hitKind: string, match: boolean) {
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

function moveOutcome(
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
