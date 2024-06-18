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

  async onOpen(): Promise<void> {
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

    const onUpdateRoll = async (): Promise<void> => {
      rollSetting.setDesc(render(this.currentRoll));
      flipSetting.setDesc(render((await this.currentRoll.variants()).flip));
    };

    const setRoll = async (roll: RollWrapper): Promise<void> => {
      this.currentRoll = roll;
      await onUpdateRoll();
    };

    rollSetting
      .addExtraButton((btn) =>
        btn
          .setIcon("refresh-cw")
          .onClick(async () => {
            await setRoll(await this.currentRoll.reroll());
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

    this.scope.register([], "r", async () => {
      await setRoll(await this.currentRoll.reroll());
      return false;
    });

    flipSetting.addButton((btn) => {
      btn.setButtonText("Select").onClick(async () => {
        this.accept((await this.currentRoll.variants()).flip);
      });
    });

    await onUpdateRoll();

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
