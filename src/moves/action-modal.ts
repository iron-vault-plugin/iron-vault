import { MoveActionRoll } from "@datasworn/core";
import { App, Modal, Setting } from "obsidian";
import { CharacterContext } from "../character-tracker";
import { MomentumTracker, momentumTrackerReader } from "../characters/lens";
import { ActionMoveDescription } from "./desc";
import { ActionMoveWrapper, formatRollResult } from "./wrapper";

export async function checkForMomentumBurn(
  app: App,
  move: MoveActionRoll,
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
      // TODO: if this is true, maybe I should use momentumTracker.reset or something like that?
      // or do the reset and then look at the new values?
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
    readonly move: MoveActionRoll,
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
