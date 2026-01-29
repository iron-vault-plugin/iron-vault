import { type Datasworn } from "@datasworn/core";
import {
  App,
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Modal,
  Notice,
  Setting,
} from "obsidian";

import { Dice, DiceGroup } from "@ironvault/dice";

import { determineCharacterActionContext } from "characters/action-context";
import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlockWithActor } from "mechanics/editor";
import { DieKind } from "utils/dice-roller";
import { node } from "utils/kdl";
import { CustomSuggestModal } from "utils/suggest";
import { PromptModal } from "utils/ui/prompt";
import { CharacterContext } from "../../character-tracker";
import { MomentumTracker, momentumTrackerReader } from "../../characters/lens";
import { ActionMoveDescription } from "../desc";
import { ActionMoveWrapper, formatRollResult } from "../wrapper";
import {
  parseInlineMechanics,
  rerollToInlineSyntax,
  ParsedInlineMove,
  ParsedInlineActionRoll,
} from "../../inline/syntax";
import { insertInlineText } from "../../inline/editor-utils";

export async function checkForMomentumBurn(
  app: App,
  move: Datasworn.MoveActionRoll,
  roll: ActionMoveWrapper,
  charContext: CharacterContext,
): Promise<ActionMoveDescription> {
  const currentResult = roll.result();
  const { lens, character } = charContext;
  const momentumTracker = momentumTrackerReader(lens).get(character);
  if (roll.resultWithActionScore(momentumTracker.momentum) > currentResult) {
    const shouldBurn: boolean = await new Promise((resolve, reject) => {
      new ActionModal(app, move, roll, momentumTracker, resolve, reject).open();
    });
    if (shouldBurn) {
      // Instead of generating this value here, an alternative would be for this function
      // to return its _intent_ to burn momentum. And then it could use the actual
      // character lens command to reset it and then record the results. That _should_
      // yield the same result, but would eliminate one possible source of divergence.
      return Object.assign({}, roll.move, {
        burn: {
          orig: momentumTracker.momentum,
          reset: momentumTracker.momentumReset,
        },
      } satisfies Pick<ActionMoveDescription, "burn">);
    }
  }

  return roll.move;
}

export class ActionModal extends Modal {
  accepted: boolean = false;

  constructor(
    app: App,
    readonly move: Datasworn.MoveActionRoll,
    readonly roll: ActionMoveWrapper,
    readonly momentumTracker: MomentumTracker,
    protected readonly onAccept: (shouldBurn: boolean) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    const { contentEl } = this;
    new Setting(contentEl).setName(this.move.name).setHeading();

    contentEl.createEl("p", {
      text: `You scored a ${formatRollResult(
        this.roll.result(),
      )}. Would you like to burn momentum?`,
    });

    const newResult = this.roll.resultWithActionScore(
      this.momentumTracker.momentum,
    );

    contentEl.createEl("p", {
      text: `Your current momentum is ${
        this.momentumTracker.momentum
      }. If you burn, you will have ${
        this.momentumTracker.momentumReset
      } momentum and the result will become ${formatRollResult(newResult)}.`,
    });

    new Setting(contentEl)
      .addButton((button) => {
        button
          .setCta()
          .setButtonText("Yes")
          .onClick(() => {
            this.accept(true);
          });
      })
      .addButton((button) => {
        button.setButtonText("No").onClick(() => {
          this.accept(false);
        });
      });
  }

  accept(shouldBurn: boolean): void {
    this.accepted = true;
    this.close();
    this.onAccept(shouldBurn);
  }

  override onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}

export async function rerollDie(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
) {
  const actionContext = await determineCharacterActionContext(plugin, view);
  const diceRoller = actionContext.campaignContext.diceRollerFor("move");

  // Check if inline mechanics are enabled - if so, try to find a preceding inline roll
  if (plugin.settings.useInlineMechanics) {
    const inlineRoll = findPrecedingInlineRoll(editor);
    if (inlineRoll) {
      await handleInlineReroll(
        plugin,
        editor,
        actionContext,
        diceRoller,
        inlineRoll,
      );
      return;
    }
    // No inline roll found, fall through to block-based reroll
  }

  const dieName: "action" | "vs1" | "vs2" = await CustomSuggestModal.select(
    plugin.app,
    ["action", "vs1", "vs2"],
    (item) =>
      item === "action"
        ? "Action die"
        : item === "vs1"
          ? "Challenge die 1"
          : item === "vs2"
            ? "Challenge die 2"
            : "Other",
    undefined,
    "Select the die to reroll",
  );
  let newValue: string;
  if (plugin.settings.promptForRollsInMoves) {
    newValue = await PromptModal.prompt(
      plugin.app,
      "Enter the new die roll value",
    );
  } else {
    let dieSides: number = 10;

    if (dieName === "action") {
      // Action die is always 6 sides.
      dieSides = 6;
    }
    // For challenge dice, we need to check the campaign settings to determine the number of sides.
    else if (dieName === "vs1" || dieName === "vs2") {
      // Get the number of sides for the challenge dice from the campaign settings.
      // This assumes that the campaign settings have been properly initialized and contain the sides for the dice.
      // If the campaign settings are not available, default to 10 sides for challenge dice.
      const [challenge1Sides, challenge2Sides] = actionContext.campaignContext
        .localSettings.actionRollChallengeDiceSides ?? [10, 10];
      dieSides = dieName === "vs1" ? challenge1Sides : challenge2Sides;
    }

    newValue =
      "" +
      (
        await diceRoller.rollAsync(
          DiceGroup.of(
            new Dice(
              1,
              dieSides,
              dieName === "action"
                ? DieKind.Action
                : dieName === "vs1"
                  ? DieKind.Challenge1
                  : DieKind.Challenge2,
            ),
          ),
        )
      )[0].value;
  }
  const props: { action?: string; vs1?: string; vs2?: string } = {};
  props[dieName] = newValue;
  const rerollNode = node("reroll", {
    properties: props,
  });

  // See https://github.com/iron-vault-plugin/iron-vault/issues/382 for discussion of
  // how this should work w/ actor nodes.
  appendNodesToMoveOrMechanicsBlockWithActor(
    editor,
    plugin,
    actionContext,
    rerollNode,
  );
}

/**
 * Search backwards from cursor to find the most recent inline roll (iv-move or iv-action-roll).
 * Returns the parsed data if found, null otherwise.
 */
function findPrecedingInlineRoll(
  editor: Editor,
): { parsed: ParsedInlineMove | ParsedInlineActionRoll; raw: string } | null {
  const cursor = editor.getCursor();
  const lineNum = cursor.line;

  // Search backwards through lines
  for (let line = lineNum; line >= 0; line--) {
    const lineText = editor.getLine(line);

    // Find all inline code blocks in this line (search from end to start)
    const matches = [...lineText.matchAll(/`([^`]+)`/g)];

    // If we're on the cursor line, only consider matches before the cursor
    const relevantMatches =
      line === lineNum
        ? matches.filter((m) => (m.index ?? 0) + m[0].length <= cursor.ch)
        : matches;

    // Check matches from end to start (most recent first)
    for (let i = relevantMatches.length - 1; i >= 0; i--) {
      const match = relevantMatches[i];
      const content = match[1];

      const parsed = parseInlineMechanics(content);
      if (parsed && (parsed.type === "move" || parsed.type === "action-roll")) {
        return { parsed, raw: content };
      }
    }
  }

  return null;
}

/**
 * Handle reroll for an inline roll.
 */
async function handleInlineReroll(
  plugin: IronVaultPlugin,
  editor: Editor,
  actionContext: Awaited<ReturnType<typeof determineCharacterActionContext>>,
  diceRoller: Awaited<
    ReturnType<typeof actionContext.campaignContext.diceRollerFor>
  >,
  inlineRoll: {
    parsed: ParsedInlineMove | ParsedInlineActionRoll;
    raw: string;
  },
): Promise<void> {
  const { parsed } = inlineRoll;

  const dieName: "action" | "vs1" | "vs2" = await CustomSuggestModal.select(
    plugin.app,
    ["action", "vs1", "vs2"],
    (item) =>
      item === "action"
        ? "Action die"
        : item === "vs1"
          ? "Challenge die 1"
          : item === "vs2"
            ? "Challenge die 2"
            : "Other",
    undefined,
    "Select the die to reroll",
  );

  // Get the old value
  let oldValue: number;
  if (dieName === "action") {
    oldValue = parsed.action;
  } else if (dieName === "vs1") {
    oldValue = parsed.vs1;
  } else {
    oldValue = parsed.vs2;
  }

  // Roll the new value
  let newValue: number;
  if (plugin.settings.promptForRollsInMoves) {
    const input = await PromptModal.prompt(
      plugin.app,
      "Enter the new die roll value",
    );
    newValue = parseInt(input, 10);
    if (isNaN(newValue)) {
      new Notice("Invalid die value");
      return;
    }
  } else {
    let dieSides: number = 10;

    if (dieName === "action") {
      dieSides = 6;
    } else if (dieName === "vs1" || dieName === "vs2") {
      const [challenge1Sides, challenge2Sides] = actionContext.campaignContext
        .localSettings.actionRollChallengeDiceSides ?? [10, 10];
      dieSides = dieName === "vs1" ? challenge1Sides : challenge2Sides;
    }

    newValue = (
      await diceRoller.rollAsync(
        DiceGroup.of(
          new Dice(
            1,
            dieSides,
            dieName === "action"
              ? DieKind.Action
              : dieName === "vs1"
                ? DieKind.Challenge1
                : DieKind.Challenge2,
          ),
        ),
      )
    )[0].value;
  }

  // Calculate the new challenge dice values (update if that die was rerolled)
  const newVs1 = dieName === "vs1" ? newValue : parsed.vs1;
  const newVs2 = dieName === "vs2" ? newValue : parsed.vs2;

  // Generate the reroll inline syntax
  const inlineText = rerollToInlineSyntax(
    dieName,
    oldValue,
    newValue,
    parsed.stat,
    parsed.statVal,
    parsed.adds,
    newVs1,
    newVs2,
    parsed.action,
  );

  insertInlineText(editor, inlineText);
}
