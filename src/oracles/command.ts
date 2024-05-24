import { createOrAppendMechanics } from "mechanics/editor";
import { createOracleNode } from "mechanics/node-builders";
import {
  EditorSelection,
  type App,
  type Editor,
  type MarkdownView,
} from "obsidian";
import { type Datastore } from "../datastore";
import { Oracle, OracleGroupingType } from "../model/oracle";
import { RollWrapper } from "../model/rolls";
import { CustomSuggestModal } from "../utils/suggest";
import { OracleRollerModal } from "./modal";
import { OracleRoller } from "./roller";

export function formatOraclePath(oracle: Oracle): string {
  let current = oracle.parent;
  const path = [];
  while (
    current != null &&
    current.grouping_type != OracleGroupingType.Ruleset
  ) {
    path.unshift(current.name);
    current = current.parent;
  }
  path.push(oracle.name);
  return `${path.join(" / ")}`;
}

export function oracleRuleset(oracle: Oracle): string {
  let current = oracle.parent;
  while (
    current != null &&
    current.grouping_type !== OracleGroupingType.Ruleset
  ) {
    current = current.parent;
  }
  return current?.name ?? "Unknown";
}

export async function runOracleCommand(
  app: App,
  datastore: Datastore,
  editor: Editor,
  _view: MarkdownView,
  chosenOracle?: Oracle,
): Promise<void> {
  if (!datastore.ready) {
    console.warn("data not ready");
    return;
  }

  // Detect if the line already has text on it-- this is the prompt
  let prompt: string | undefined = undefined;
  const [selection, ...rest] = editor.listSelections();
  let replaceSelection: EditorSelection = selection;
  if (selection && rest.length == 0) {
    prompt = editor.getRange(selection.anchor, selection.head);
    if (!prompt && selection.anchor.line == selection.head.line) {
      prompt = editor.getLine(selection.anchor.line);
      console.log("prompt: '%s'", prompt);

      // TODO: if I wanted to split the line around the cursor, this is how I can do it!
      // const rightMost = Math.max(selection.anchor.ch, selection.head.ch);
      // const afterText = prompt.slice(rightMost);
      // if (afterText.length > 0) {
      //   console.warn("after text: %s", afterText);
      // }

      // In this scenario, we will replace the whole line with the oracle block
      replaceSelection = {
        anchor: { line: selection.anchor.line, ch: 0 },
        head: { line: selection.anchor.line, ch: prompt.length },
      };
    }

    prompt = prompt.trim();
    if (!prompt) {
      prompt = undefined;
    }
  } else {
    console.error(
      "Canceling oracle: Expected exactly one selection; found %d: %o",
    );
    return;
  }

  let oracle: Oracle;
  if (chosenOracle) {
    oracle = chosenOracle;
  } else {
    const oracles: Oracle[] = [...datastore.oracles.values()];
    oracle = await CustomSuggestModal.select(
      app,
      oracles,
      formatOraclePath,
      (match, el) => {
        const ruleset = oracleRuleset(match.item);
        el.createEl("small", { text: ruleset, cls: "iron-vault-suggest-hint" });
      },
      prompt ? `Select an oracle to answer '${prompt}'` : "Select an oracle",
    );
  }
  console.log(oracle);
  const rollContext = new OracleRoller(datastore.oracles);
  new OracleRollerModal(
    app,
    oracle,
    new RollWrapper(oracle, rollContext),
    (roll) => {
      // Delete the prompt and then inject the oracle node to a mechanics block
      editor.setSelection(replaceSelection.anchor, replaceSelection.head);
      editor.replaceSelection("");
      createOrAppendMechanics(editor, [createOracleNode(roll, prompt)]);
    },
    () => {},
  ).open();
}
