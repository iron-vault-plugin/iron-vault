import { type Datasworn } from "@datasworn/core";
import { determineCharacterActionContext } from "characters/action-context";
import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlockWithActor } from "mechanics/editor";
import {
  App,
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Modal,
  Setting,
} from "obsidian";
import { Dice, DieKind } from "utils/dice";
import { node } from "utils/kdl";
import { CustomSuggestModal } from "utils/suggest";
import { PromptModal } from "utils/ui/prompt";
import { CharacterContext } from "../../character-tracker";
import { MomentumTracker, momentumTrackerReader } from "../../characters/lens";
import { ActionMoveDescription } from "../desc";
import { ActionMoveWrapper, formatRollResult } from "../wrapper";

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

  onOpen(): void {
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

  onClose(): void {
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
    newValue =
      "" +
      (await new Dice(
        1,
        dieName === "action" ? 6 : 10,
        plugin,
        dieName === "action"
          ? DieKind.Action
          : dieName === "vs1"
            ? DieKind.Challenge1
            : DieKind.Challenge2,
      ).roll());
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
