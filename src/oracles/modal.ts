import { type Roll } from "model/rolls";
import { Modal, Setting, type App } from "obsidian";
import { type RollWrapper, type TableWrapper } from "./roller";

export class OracleRollerModal extends Modal {
  public accepted: boolean = false;

  constructor(
    app: App,
    protected oracle: TableWrapper,
    public currentRoll: RollWrapper = oracle.roll(),
    protected readonly onAccept: (roll: Roll) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    contentEl.createEl("h1", { text: this.oracle.value.Title.Standard });

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

    const setRoll = (roll: RollWrapper): void => {
      this.currentRoll = roll;
      rollSetting.setDesc(render(this.currentRoll));
      flipSetting.setDesc(render(this.currentRoll.flip));
    };

    rollSetting
      .addExtraButton((btn) =>
        btn.setIcon("refresh-cw").onClick(() => {
          setRoll(this.oracle.roll());
        }),
      )
      .addButton((btn) => {
        btn
          .setButtonText("Select")
          .setCta()
          .onClick(() => {
            this.accept(this.currentRoll);
          });
      });

    flipSetting.addButton((btn) => {
      btn.setButtonText("Select").onClick(() => {
        this.accept(this.currentRoll.flip);
      });
    });

    setRoll(this.currentRoll);

    new Setting(contentEl).addButton((button) => {
      button.setButtonText("Cancel").onClick(() => {
        this.close();
      });
    });
  }

  accept(roll: RollWrapper): void {
    this.accepted = true;
    this.close();
    this.onAccept(roll.value);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
