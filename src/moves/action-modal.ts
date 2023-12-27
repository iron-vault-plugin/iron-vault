import { MoveActionRoll } from "@datasworn/core";
import { IronswornCharacterMetadata } from "character";
import { App, Modal, Setting } from "obsidian";
import { ActionMoveDescription } from "./desc";
import { ActionMoveWrapper, formatRollResult } from "./wrapper";

export async function checkForMomentumBurn(
  app: App,
  move: MoveActionRoll,
  roll: ActionMoveWrapper,
  character: IronswornCharacterMetadata,
): Promise<ActionMoveDescription> {
  const currentResult = roll.result();
  const measures = character.measures;
  const reset = character.momentumReset;
  if (roll.resultWithActionScore(measures.momentum) > currentResult) {
    const shouldBurn: boolean = await new Promise((resolve, reject) => {
      new ActionModal(
        app,
        move,
        roll,
        measures.momentum,
        reset,
        resolve,
        reject,
      ).open();
    });
    if (shouldBurn) {
      return Object.assign({}, roll.move, {
        burn: { orig: measures.momentum, reset },
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
    readonly currentMomentum: number,
    readonly momentumReset: number,
    protected readonly onAccept: (shouldBurn: boolean) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h1", { text: this.move.name });

    contentEl.createEl("p", {
      text: `You scored a ${formatRollResult(
        this.roll.result(),
      )}. Would you like to burn momentum?`,
    });

    const newResult = this.roll.resultWithActionScore(this.currentMomentum);

    contentEl.createEl("p", {
      text: `Your current momentum is ${
        this.currentMomentum
      }. If you burn, you will have ${
        this.momentumReset
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
