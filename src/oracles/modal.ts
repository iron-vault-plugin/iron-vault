import { Oracle } from "model/oracle";
import { RollWrapper } from "model/rolls";
import { Modal, Setting, type App } from "obsidian";

export class OracleRollerModal extends Modal {
  public accepted: boolean = false;

  constructor(
    app: App,
    protected oracle: Oracle,
    public currentRoll: RollWrapper,
    protected readonly onAccept: (roll: RollWrapper) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName(this.oracle.name).setHeading();

    // new Setting(contentEl).addButton((btn) =>
    //   btn
    //     .setButtonText("Accept")
    //     .setCta()
    //     .onClick(() => {
    //       this.accepted = true;
    //       this.close();
    //       this.onAccept(this.currentRoll);
    //     }),
    // );

    const rollSetting = new Setting(contentEl).setName("Current roll");
    const flipSetting = new Setting(contentEl).setName("Flipped roll");

    const render = (roll: RollWrapper): string => {
      const evaledRoll = roll.dehydrate();
      return `${evaledRoll.roll}: ${evaledRoll.results.join("; ")}`;
    };

    const onUpdateRoll = (): void => {
      rollSetting.setDesc(render(this.currentRoll));
      flipSetting.setDesc(render(this.currentRoll.variants["flip"]));
    };

    const setRoll = (roll: RollWrapper): void => {
      this.currentRoll = roll;
      onUpdateRoll();
    };

    rollSetting
      .addExtraButton((btn) =>
        btn
          .setIcon("refresh-cw")
          .onClick(() => {
            setRoll(this.currentRoll.reroll());
          })
          .setTooltip("Re-roll (r)"),
      )
      .addButton((btn) => {
        btn
          .setButtonText("Select")
          .setCta()
          .onClick(() => {
            this.accept(this.currentRoll);
          });
      });

    this.scope.register([], "r", (evt, ctx) => {
      setRoll(this.currentRoll.reroll());
      return false;
    });

    flipSetting.addButton((btn) => {
      btn.setButtonText("Select").onClick(() => {
        this.accept(this.currentRoll.variants.flip);
      });
    });

    onUpdateRoll();

    new Setting(contentEl).addButton((button) => {
      button.setButtonText("Cancel").onClick(() => {
        this.close();
      });
    });
  }

  accept(roll: RollWrapper): void {
    this.accepted = true;
    this.close();
    this.onAccept(roll);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
