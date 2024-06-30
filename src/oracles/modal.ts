import IronVaultPlugin from "index";
import { CurseBehavior, Oracle } from "model/oracle";
import { RollWrapper } from "model/rolls";
import { Modal, Setting } from "obsidian";
import { Dice, DieKind } from "utils/dice";
import { stripMarkdown } from "utils/strip-markdown";

export class OracleRollerModal extends Modal {
  public accepted: boolean = false;
  public cursedRoll?: RollWrapper;

  constructor(
    private plugin: IronVaultPlugin,
    protected oracle: Oracle,
    public currentRoll: RollWrapper,
    protected readonly onAccept: (
      roll: RollWrapper,
      cursedRoll?: RollWrapper,
    ) => void,
    protected readonly onCancel: () => void,
  ) {
    super(plugin.app);
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
    let cursedSetting: Setting | undefined;
    if (this.currentRoll.cursedRoll != null && this.currentRoll.cursedTable) {
      const cursedHeading = new Setting(contentEl)
        .setName(this.currentRoll.cursedTable.name)
        .setDesc(`Cursed die: ${this.currentRoll.cursedRoll}`)
        .setHeading()
        .addButton((btn) =>
          btn.setIcon("refresh-cw").onClick(async () => {
            const newCursedRoll = await new Dice(
              1,
              this.plugin.settings.cursedDieSides,
              this.plugin,
              DieKind.Cursed,
            ).roll();
            await setRoll(this.currentRoll.withCursedRoll(newCursedRoll));
            await onUpdateCursedRoll();
          }),
        );
      const name =
        this.currentRoll.cursedTable?.curseBehavior === CurseBehavior.AddResult
          ? "Add result"
          : "Replace result";
      const desc =
        this.currentRoll.cursedTable?.curseBehavior === CurseBehavior.AddResult
          ? "The cursed table's result will be added to the regular oracle roll"
          : "The cursed table's result will replace the regular oracle roll";
      cursedSetting = new Setting(contentEl).setName(name).setDesc(desc);
      const onUpdateCursedRoll = async (): Promise<void> => {
        cursedHeading.setDesc(`Cursed die: ${this.currentRoll.cursedRoll}`);
        if (cursedSetting && this.cursedRoll) {
          cursedSetting.clear();
          cursedSetting
            .setDesc(render(this.cursedRoll))
            .addExtraButton((btn) =>
              btn.setIcon("refresh-cw").onClick(async () => {
                if (this.cursedRoll && this.currentRoll.cursedTable) {
                  await setCursedRoll(await this.cursedRoll.reroll());
                }
              }),
            )
            .addButton((btn) => {
              btn
                .setButtonText("Select")
                .setCta()
                .onClick(() => {
                  this.accept(this.currentRoll, this.cursedRoll);
                });
            });
        }
      };
      const setCursedRoll = async (roll: RollWrapper): Promise<void> => {
        this.cursedRoll = roll;
        await onUpdateCursedRoll();
      };
      cursedSetting.addButton((btn) =>
        btn.setIcon("dice").onClick(async () => {
          const res = await this.currentRoll.cursedTable?.roll(
            this.currentRoll.context,
          );
          if (res && this.currentRoll.cursedTable) {
            await setCursedRoll(
              new RollWrapper(
                this.currentRoll.cursedTable,
                this.currentRoll.context,
                res,
              ),
            );
          }
        }),
      );
    }

    const render = (roll: RollWrapper): string => {
      const evaledRoll = roll.dehydrate();
      return stripMarkdown(
        this.plugin,
        `${evaledRoll.roll}: ${evaledRoll.results.join("; ")}`,
      );
    };

    const onUpdateRoll = async (): Promise<void> => {
      rollSetting.setDesc(render(this.currentRoll));
      flipSetting.setDesc(render((await this.currentRoll.variants()).flip));
      if (cursedSetting && this.cursedRoll) {
        cursedSetting.setDesc(render(this.cursedRoll));
      }
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

  accept(roll: RollWrapper, cursedRoll?: RollWrapper): void {
    this.accepted = true;
    this.close();
    this.onAccept(roll, cursedRoll);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
