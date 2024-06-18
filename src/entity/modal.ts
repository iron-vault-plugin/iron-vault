import {
  App,
  MarkdownRenderChild,
  MarkdownRenderer,
  Modal,
  Setting,
} from "obsidian";
import { partition } from "utils/partition";
import { Oracle, RollContext } from "../model/oracle";
import { RollWrapper } from "../model/rolls";
import {
  AttributeMechanism,
  EntityAttributeFieldSpec,
  EntityDescriptor,
  EntityFieldSpec,
  EntityResults,
  EntitySpec,
  isEntityAttributeSpec,
} from "./specs";

const SAFE_SNAKECASE_RESULT = /^[a-z0-9\s]+$/i;
// [Rocky World](id:starforged/collections/oracles/planets/rocky)
const ATTRIBUTE_LINK = /\[([\w ]*)\]\(id:([\w/:]+)\)/;

function evaluateAttribute(
  spec: EntityAttributeFieldSpec,
  roll: RollWrapper[],
): string {
  if (roll.length != 1) {
    throw new Error(`unexpected number of rolls for attribute: ${roll.length}`);
  }
  const rawResult = roll[0].simpleResult;
  switch (spec.definesAttribute.mechanism) {
    case AttributeMechanism.Snakecase:
      if (!rawResult.match(SAFE_SNAKECASE_RESULT))
        throw new Error(
          `attribute value did not have snakecase-compatible result: ${rawResult}`,
        );
      return rawResult.replaceAll(/\s+/g, "_").toLowerCase();
    case AttributeMechanism.ParseId: {
      const match = rawResult.match(ATTRIBUTE_LINK);
      if (!match) throw new Error(`no id link found: ${rawResult}`);
      const parts = match[2].split("/");
      if (parts.length < 2) throw new Error(`no / separator in ${rawResult}`);
      return parts.last()!;
    }
  }
}

export type EntityModalResults<T extends EntitySpec> = {
  createFile: boolean;
  entity: EntityResults<T>;
};

export class EntityModal<T extends EntitySpec> extends Modal {
  public accepted: boolean = false;
  public readonly results: EntityModalResults<T>;

  static create<T extends EntitySpec>({
    app,
    entityDesc,
    rollContext,
    initialEntity,
  }: {
    app: App;
    entityDesc: EntityDescriptor<T>;
    rollContext: RollContext;
    initialEntity: Partial<EntityResults<T>>;
  }): Promise<EntityModalResults<T>> {
    return new Promise((onAccept, onCancel) => {
      let modal;
      try {
        modal = new this(
          app,
          entityDesc,
          initialEntity,
          rollContext,
          onAccept,
          onCancel,
        );
        modal.open();
      } catch (e) {
        onCancel(e);
        if (modal) modal.close();
      }
    });
  }

  protected constructor(
    app: App,
    public readonly entityDesc: EntityDescriptor<T>,
    public readonly initialEntity: Partial<EntityResults<T>>,
    public readonly rollContext: RollContext,
    public readonly onAccept: (results: EntityModalResults<T>) => void,
    public readonly onCancel: () => void,
  ) {
    super(app);
    this.results = {
      createFile: false,
      entity: Object.fromEntries(
        Object.entries(entityDesc.spec).map(([key]) => [
          key,
          initialEntity[key] ?? [],
        ]),
      ) as Record<keyof T, RollWrapper[]>,
    };
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;

    const settings: Record<keyof T, { setting: Setting; table: Oracle }> =
      {} as Record<keyof T, { setting: Setting; table: Oracle }>;

    const render = (roll: RollWrapper): string => {
      const evaledRoll = roll.dehydrate();
      return `${evaledRoll.roll}: ${evaledRoll.results
        .map((val) => {
          // NB(@zkat): this field is actually markdown, but we don't want
          // to render it proper, so we do a bit of a maneuver to extract
          // the text itself.
          const div = document.createElement("div");
          MarkdownRenderer.render(
            this.app,
            val,
            div,
            "",
            new MarkdownRenderChild(div),
          );
          return div.innerText;
        })
        .join(", ")}`;
    };

    const renderRolls = (rolls: RollWrapper[]): string => {
      return rolls.map(render).join("; ");
    };

    // const getTextComponent = (key: string): TextComponent | undefined => {
    //   return settings[key]?.components.find(
    //     (component): component is TextComponent =>
    //       component instanceof TextComponent,
    //   );
    // };

    const rollForKey = async (key: keyof T): Promise<void> => {
      const { setting, table } = settings[key];
      this.results.entity[key] = [
        new RollWrapper(
          table,
          this.rollContext,
          await table.roll(this.rollContext),
        ),
      ];
      // getTextComponent(key)?.setValue(render(this.results[key][0]));
      setting.setName(renderRolls(this.results.entity[key]));
    };

    const clearKey = (key: keyof T): void => {
      const { setting } = settings[key];
      this.results.entity[key] = [];
      // getTextComponent(key)?.setValue("");
      setting.setName("");
      // settings[key].setName(table.name);
    };

    const { spec: entitySpec } = this.entityDesc;

    new Setting(contentEl).setName(this.entityDesc.label).setHeading();

    const [attributes, slots] = partition(
      Object.entries(entitySpec) as [keyof T, EntityFieldSpec][],
      (elem): elem is [keyof T, EntityAttributeFieldSpec] =>
        isEntityAttributeSpec(elem[1]),
    );

    attributes.sort(
      ([_a, specA], [_b, specB]) =>
        specA.definesAttribute.order - specB.definesAttribute.order,
    );

    const attributeValues: Partial<Record<keyof T, string>> = {};

    for (const [key, spec] of attributes) {
      const { id } = spec;
      const table = this.rollContext.lookup(id);
      if (!table) {
        // this.close();
        throw new Error("missing table " + id);
      }
      const setting = new Setting(contentEl)
        .setName(renderRolls(this.results.entity[key]))
        .setDesc(spec.name ?? table.name);

      setting.descEl.ariaLabel = `(id: ${table.id})`;

      attributeValues[key] = evaluateAttribute(spec, this.results.entity[key]);

      settings[key] = { setting, table };
    }

    for (const [key, { id, name }] of slots) {
      const formattedId = id.replaceAll(/\{\{(\w+)\}\}/g, (_, attribute) => {
        const val = attributeValues[attribute];
        if (!val) {
          throw new Error(`unexpected attribute '${attribute}' in id '${id}'`);
        }
        return val;
      });

      const table = this.rollContext.lookup(formattedId);
      if (!table) {
        throw new Error("missing table " + formattedId);
      }

      const setting = new Setting(contentEl)
        .setName("")
        .setDesc(name ?? table.name)
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
      setting.descEl.ariaLabel = `(id: ${table.id})`;
      settings[key] = { setting, table };
    }

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Roll First Look").onClick(() => {
          for (const [key, spec] of slots) {
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

    new Setting(contentEl).setName("Create entity file").addToggle((toggle) =>
      toggle
        .setTooltip(
          "If enabled, a new file will be created with the entity template.",
        )
        .setValue(this.results.createFile)
        .onChange((val) => {
          this.results.createFile = val;
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
