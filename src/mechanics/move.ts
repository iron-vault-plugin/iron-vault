import { Node as KdlNode } from "kdljs";
import { App, Component, MarkdownRenderer } from "obsidian";

export default async function renderMove(app: App, el: HTMLElement, node: KdlNode, sourcePath: string, parent: Component) {
  const moveName = node.values[0] as string;
  const moveNode = el.createEl("details", { cls: "forged-move" });
  const summary = moveNode.createEl("summary");
  await renderMarkdown(summary, moveName);
  let lastRoll = undefined;
  for (const item of node.children) {
    const name = item.name.toLowerCase();
    switch (name) {
      case "-": {
        await renderDetail(moveNode, item, renderMarkdown);
        break;
      }
      case "add": {
        renderAdd(moveNode, item);
        break;
      }
      case "roll": {
        lastRoll = item;
        renderRoll(moveNode, item);
        break;
      }
      case "progress-roll": {
        lastRoll = item;
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
      case "burn": {
        // TODO
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
      case "meter": {
        // TODO
        break;
      }
      default: {
        renderUnknown(moveNode, name);
      }
    }
  }
  async function renderMarkdown(el: HTMLElement, md: string) {
    await MarkdownRenderer.render(app, md, el, sourcePath, parent);
  }
}

// --- Util ---

function setMoveHit(moveEl: HTMLElement, hitKind: string, match: boolean) {
  switch (hitKind) {
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

// --- Renderers ---

async function renderDetail(moveNode: HTMLElement, item: KdlNode, renderMarkdown: (el: HTMLElement, md: string) => Promise<void>) {
  const detailNode = moveNode.createEl("p", {
    cls: "detail",
  });
  await renderMarkdown(detailNode, item.values[0] as string);
}

function renderAdd(moveNode: HTMLElement, add: KdlNode) {
  moveNode.createEl("p", {
    cls: "add",
    text: `Add +${add.values[0]}${add.values[1] ? " (" + add.values[1] + ")" : ""}`,
  });
}

function renderRoll(moveNode: HTMLElement, roll: KdlNode) {
  const action = roll.properties["action"] as number;
  const statName = roll.values[0] as string;
  const stat = roll.properties.stat as number;
  const adds = roll.properties.adds as number ?? 0;
  const score = Math.min(10, action + stat + adds);
  const challenge1 = roll.properties["vs1"] as number;
  const challenge2 = roll.properties["vs2"] as number;
  const rollNode = moveNode.createEl("dl", {
    cls: "roll",
  });
  let outcome;
  if (score > challenge1 && score > challenge2) {
    rollNode.addClass("strong-hit");
    setMoveHit(moveNode, "strong-hit", challenge1 === challenge2);
    outcome = "Strong Hit";
  } else if (score > challenge1 || score > challenge2) {
    rollNode.addClass("weak-hit");
    setMoveHit(moveNode, "weak-hit", challenge1 === challenge2);
    outcome = "Weak Hit";
  } else {
    rollNode.addClass("miss");
    setMoveHit(moveNode, "miss", challenge1 === challenge2);
    outcome = "Miss";
  }
  if (challenge1 === challenge2) {
    rollNode.addClass("match");
    outcome += " (Match)";
  }
  rollNode.createEl("dt", {
    text: "Action Die",
  });
  rollNode
    .createEl("dd", {
      cls: "action-die",
      text: "" + action,
    })
    .setAttribute("data-value", "" + action);
  rollNode.createEl("dt", {
    text: "Stat",
  });
  rollNode
    .createEl("dd", {
      cls: "stat",
      text: "" + stat,
    })
    .setAttribute("data-value", "" + stat);
  if (statName) {
    rollNode.createEl("dt", {
      text: "Stat Name",
    });
    rollNode
      .createEl("dd", {
        cls: "stat-name",
        text: statName,
      })
      .setAttribute("data-value", statName);
  }
  rollNode.createEl("dt", {
    text: "Adds",
  });
  rollNode
    .createEl("dd", {
      cls: "adds",
      text: "" + adds,
    })
    .setAttribute("data-value", "" + adds);
  rollNode.createEl("dt", {
    text: "Score",
  });
  rollNode
    .createEl("dd", {
      cls: "score",
      text: "" + score,
    })
    .setAttribute("data-value", "" + score);
  rollNode.createEl("dt", {
    text: "Challenge Die 1",
  });
  rollNode
    .createEl("dd", {
      cls: "challenge-die",
      text: "" + challenge1,
    })
    .setAttribute("data-value", "" + challenge1);
  rollNode.createEl("dt", {
    text: "Challenge Die 2",
  });
  rollNode
    .createEl("dd", {
      cls: "challenge-die",
      text: "" + challenge2,
    })
    .setAttribute("data-value", "" + challenge2);
  rollNode.createEl("dt", {
    text: "Outcome",
  });
  rollNode.createEl("dd", {
    cls: "outcome",
    text: outcome,
  });
}

function renderProgress(moveNode: HTMLElement, roll: KdlNode) {
  const score = roll.properties.score as number;
  const challenge1 = roll.properties["vs1"] as number;
  const challenge2 = roll.properties["vs2"] as number;
  const rollNode = moveNode.createEl("dl", {
    cls: "roll progress",
  });
  let outcome;
  if (score > challenge1 && score > challenge2) {
    rollNode.addClass("strong-hit");
    setMoveHit(moveNode, "strong-hit", challenge1 === challenge2);
    outcome = "Strong Hit";
  } else if (score > challenge1 || score > challenge2) {
    rollNode.addClass("weak-hit");
    setMoveHit(moveNode, "weak-hit", challenge1 === challenge2);
    outcome = "Weak Hit";
  } else {
    rollNode.addClass("miss");
    setMoveHit(moveNode, "miss", challenge1 === challenge2);
    outcome = "Miss";
  }
  if (challenge1 === challenge2) {
    rollNode.addClass("match");
    outcome += " (Match)";
  }
  rollNode.createEl("dt", {
    text: "Progress Score",
  });
  rollNode
    .createEl("dd", {
      cls: "progress-score",
      text: "" + score,
    })
    .setAttribute("data-value", "" + score);
  rollNode.createEl("dt", {
    text: "Challenge Die 1",
  });
  rollNode
    .createEl("dd", {
      cls: "challenge-die",
      text: "" + challenge1,
    })
    .setAttribute("data-value", "" + challenge1);
  rollNode.createEl("dt", {
    text: "Challenge Die 2",
  });
  rollNode
    .createEl("dd", {
      cls: "challenge-die",
      text: "" + challenge2,
    })
    .setAttribute("data-value", "" + challenge2);
  rollNode.createEl("dt", {
    text: "Outcome",
  });
  rollNode.createEl("dd", {
    cls: "outcome",
    text: outcome,
  });
}

function renderDieRoll(moveNode: HTMLElement, roll: KdlNode) {
  const rollNode = moveNode.createEl("dl", {
    cls: "die-roll",
  });
  const reason = roll.values[0] as string;
  const value = roll.values[1] as number;
  rollNode.createEl("dt", {
    text: reason,
  });
  rollNode
    .createEl("dd", {
      cls: "",
      text: "" + value,
    })
    .setAttribute("data-value", "" + value);
}

function renderReroll(moveNode: HTMLElement, roll: KdlNode, lastRoll: KdlNode) {
  const rerollNode = moveNode.createEl("dl", {
    cls: "reroll",
  });
  const action = lastRoll.properties.action as number | undefined;
  const newScore = Math.min(
    ((roll.properties.action ?? action) as number) +
      (lastRoll.properties.stat as number) +
      (lastRoll.properties.adds as number ?? 0),
    10,
  );
  const lastVs1 = lastRoll.properties.vs1 as number;
  const lastVs2 = lastRoll.properties.vs2 as number;
  const newVs1 = (roll.properties.vs1 ?? lastRoll.properties.vs1) as number;
  const newVs2 = (roll.properties.vs2 ?? lastRoll.properties.vs2) as number;
  let outcome;
  if (newScore > newVs1 && newScore > newVs2) {
    rerollNode.addClass("strong-hit");
    setMoveHit(moveNode, "strong-hit", newVs1 === newVs2);
    outcome = "Strong Hit";
  } else if (newScore > newVs1 || newScore > newVs2) {
    rerollNode.addClass("weak-hit");
    setMoveHit(moveNode, "weak-hit", newVs1 === newVs2);
    outcome = "Weak Hit";
  } else {
    rerollNode.addClass("miss");
    setMoveHit(moveNode, "miss", newVs1 === newVs2);
    outcome = "Miss";
  }
  if (newVs1 === newVs2) {
    rerollNode.addClass("match");
    outcome += " (Match)";
  }
  if (roll.properties.action != null) {
    const newAction = roll.properties.action as number;
    lastRoll.properties.action = newAction;
    rerollNode.createEl("dt", {
      text: "Old Action Die",
    });
    rerollNode
      .createEl("dd", {
        cls: "action-die",
        text: "" + action,
      })
      .setAttribute("data-value", "" + action);
    rerollNode.createEl("dt", {
      text: "New Action Die",
    });
    rerollNode
      .createEl("dd", {
        cls: "action-die",
        text: "" + newAction,
      })
      .setAttribute("data-value", "" + newAction);
  }
  if (roll.properties.vs1 != null) {
    const newVs1 = roll.properties.vs1 as number;
    lastRoll.properties.vs1 = newVs1;
    rerollNode.createEl("dt", {
      text: "Old Challenge Die 1",
    });
    rerollNode
      .createEl("dd", {
        cls: "challenge-die",
        text: "" + lastVs1,
      })
      .setAttribute("data-value", "" + lastVs1);
    rerollNode.createEl("dt", {
      text: "New Challenge Die 1",
    });
    rerollNode
      .createEl("dd", {
        cls: "challenge-die",
        text: "" + newVs1,
      })
      .setAttribute("data-value", "" + newVs1);
  }
  if (roll.properties.vs2 != null) {
    const newVs2 = roll.properties.vs2 as number;
    lastRoll.properties.vs2 = newVs2;
    rerollNode.createEl("dt", {
      text: "Old Challenge Die 2",
    });
    rerollNode
      .createEl("dd", {
        cls: "challenge-die",
        text: "" + lastVs2,
      })
      .setAttribute("data-value", "" + lastVs2);
    rerollNode.createEl("dt", {
      text: "New Challenge Die 2",
    });
    rerollNode
      .createEl("dd", {
        cls: "challenge-die",
        text: "" + newVs2,
      })
      .setAttribute("data-value", "" + newVs2);
  }
  rerollNode.createEl("dt", {
    text: "New Score",
  });
  rerollNode
    .createEl("dd", {
      cls: "score",
      text: "" + newScore,
    })
    .setAttribute("data-value", "" + newScore);
  rerollNode.createEl("dt", {
    text: "Outcome",
  });
  rerollNode.createEl("dd", {
    cls: "outcome",
    text: outcome,
  });
}

function renderUnknown(moveNode: HTMLElement, name: string) {
  moveNode.createEl("p", {
    text: `Unknown move node: "${name}"`,
    cls: "error",
  });
}
