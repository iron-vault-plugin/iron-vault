import { RollContext } from "model/oracle";
import { RollWrapper } from "model/rolls";
import { App, Modal, Setting } from "obsidian";

export type EntitySpec = Record<string, { id: string }>;

export class EntityModal extends Modal {
  public readonly results: Record<string, any> = {};

  constructor(
    app: App,
    public readonly entitySpec: EntitySpec,
    public readonly rollContext: RollContext,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;

    const settings: Record<string, Setting> = {};

    const render = (roll: RollWrapper): string => {
      const evaledRoll = roll.dehydrate();
      return `${evaledRoll.roll}: ${evaledRoll.results.join("; ")}`;
    };

    for (const key in this.entitySpec) {
      const { id } = this.entitySpec[key];
      const table = this.rollContext.lookup(id);
      if (!table) {
        this.close();
        throw new Error("missing table " + id);
      }

      settings[key] = new Setting(contentEl)
        .setName(table.name)
        .setDesc("")
        .addExtraButton((btn) =>
          btn.setIcon("refresh-cw").onClick(() => {
            this.results[key] = new RollWrapper(table, this.rollContext);
            settings[key].setDesc(render(this.results[key]));
          }),
        );
    }

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Accept")
          .setCta()
          .onClick(() => {
            // TODO: accept
            console.log(this.results);
            this.close();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          // TODO: cancel
          this.close();
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
