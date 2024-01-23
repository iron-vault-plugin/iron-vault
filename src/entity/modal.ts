import { Oracle, RollContext } from "model/oracle";
import { RollWrapper } from "model/rolls";
import { App, Modal, Setting } from "obsidian";

export type EntityDescriptor<T extends EntitySpec> = {
  label: string;
  nameGen?: (ent: EntityResults<T>) => string;
  spec: T;
};
export type EntitySpec = Record<string, { id: string; firstLook: boolean }>;
export type EntityResults<T extends EntitySpec> = {
  [key in keyof T]: RollWrapper[];
};

export class EntityModal<T extends EntitySpec> extends Modal {
  public accepted: boolean = false;
  public readonly results: EntityResults<T>;

  static create<T extends EntitySpec>({
    app,
    entityDesc,
    rollContext,
  }: {
    app: App;
    entityDesc: EntityDescriptor<T>;
    rollContext: RollContext;
  }): Promise<EntityResults<T>> {
    return new Promise((onAccept, onCancel) => {
      new this(app, entityDesc, rollContext, onAccept, onCancel).open();
    });
  }

  protected constructor(
    app: App,
    public readonly entityDesc: EntityDescriptor<T>,
    public readonly rollContext: RollContext,
    public readonly onAccept: (results: EntityResults<T>) => void,
    public readonly onCancel: () => void,
  ) {
    super(app);
    this.results = Object.fromEntries(
      Object.entries(entityDesc.spec).map(([key]) => [
        key,
        [] as RollWrapper[],
      ]),
    ) as Record<keyof T, RollWrapper[]>;
    console.log("init results: %o", this.results);
  }

  onOpen(): void {
    const { contentEl } = this;

    const settings: Record<keyof T, { setting: Setting; table: Oracle }> =
      {} as Record<keyof T, { setting: Setting; table: Oracle }>;

    const render = (roll: RollWrapper): string => {
      const evaledRoll = roll.dehydrate();
      return `${evaledRoll.roll}: ${evaledRoll.results.join("; ")}`;
    };

    // const getTextComponent = (key: string): TextComponent | undefined => {
    //   return settings[key]?.components.find(
    //     (component): component is TextComponent =>
    //       component instanceof TextComponent,
    //   );
    // };

    const rollForKey = (key: keyof T): void => {
      const { setting, table } = settings[key];
      this.results[key] = [new RollWrapper(table, this.rollContext)];
      // getTextComponent(key)?.setValue(render(this.results[key][0]));
      setting.setName(render(this.results[key][0]));
      setting.setDesc(table.name);
    };

    const clearKey = (key: keyof T): void => {
      const { setting } = settings[key];
      this.results[key] = [];
      // getTextComponent(key)?.setValue("");
      setting.setName("");
      // settings[key].setName(table.name);
    };

    const { spec: entitySpec } = this.entityDesc;

    contentEl.createEl("h1", { text: this.entityDesc.label });

    for (const key in entitySpec) {
      const { id } = entitySpec[key];
      const table = this.rollContext.lookup(id);
      if (!table) {
        this.close();
        throw new Error("missing table " + id);
      }

      const setting = new Setting(contentEl)
        .setName("")
        .setDesc(table.name)
        // .addText((text) => text.setDisabled(true).setValue(""))
        .addExtraButton((btn) =>
          btn.setIcon("dices").onClick(() => {
            rollForKey(key);
          }),
        )
        .addExtraButton((btn) =>
          btn.setIcon("delete").onClick(() => {
            clearKey(key);
          }),
        );
      settings[key] = { setting, table };
    }

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Roll First Look").onClick(() => {
          for (const [key, spec] of Object.entries(this.entityDesc.spec)) {
            if (spec.firstLook) {
              rollForKey(key);
            } else {
              clearKey(key);
            }
          }
        }),
      )
      .addButton((btn) =>
        btn.setButtonText("Clear").onClick(() => {
          for (const key of Object.keys(this.entityDesc.spec)) {
            clearKey(key);
          }
        }),
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Accept")
          .setCta()
          .onClick(() => {
            this.accept();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.cancel();
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }

  accept(): void {
    this.accepted = true;
    this.onAccept(this.results);
    this.close();
  }

  cancel(): void {
    this.accepted = false;
    this.close();
  }
}
