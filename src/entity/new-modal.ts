import { parseDataswornLinks } from "datastore/parsers/datasworn/id";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import { guard } from "lit-html/directives/guard.js";
import { join } from "lit-html/directives/join.js";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { repeat } from "lit-html/directives/repeat.js";
import { rootLogger } from "logger";
import {
  ButtonComponent,
  ExtraButtonComponent,
  Modal,
  normalizePath,
  Setting,
  TextComponent,
} from "obsidian";
import {
  createRollContainer,
  IRollContainer,
  NewOracleRollerModal,
  RollContainer,
} from "oracles/new-modal";
import { FolderTextSuggest } from "utils/ui/settings/folder";
import { RollContext } from "../model/oracle";
import { RollWrapper } from "../model/rolls";
import {
  EntityAttributeFieldSpec,
  EntityDescriptor,
  EntityFieldSpec,
  EntityResults,
  EntitySpec,
  evaluateAttribute,
  evaluateSlotId,
  hasAllProperties,
  isEntityAttributeSpec,
} from "./specs";

const logger = rootLogger.getLogger("entity/new-modal");

export type EntityModalResults<T extends EntitySpec> = {
  createFile: boolean;
  fileName: string;
  targetFolder: string;
  entity: EntityResults<T>;
};

export type EntityState<T extends EntitySpec> = {
  [key in keyof T]: IRollContainer[];
};

export class NewEntityModal<T extends EntitySpec> extends Modal {
  public accepted: boolean = false;
  public readonly results: EntityModalResults<T>;
  attributesEl!: HTMLDivElement;
  activeSlots!: [keyof T, EntityFieldSpec][];

  static create<T extends EntitySpec>({
    plugin,
    entityDesc,
    rollContext,
    initialEntity,
  }: {
    plugin: IronVaultPlugin;
    entityDesc: EntityDescriptor<T>;
    rollContext: RollContext;
    initialEntity: Partial<EntityResults<T>>;
  }): Promise<EntityModalResults<T>> {
    return new Promise((onAccept, onCancel) => {
      let modal;
      try {
        modal = new this(
          plugin,
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

  rolls: Map<string, RollContainer[]> = new Map();

  protected constructor(
    public plugin: IronVaultPlugin,
    public readonly entityDesc: EntityDescriptor<T>,
    public readonly initialEntity: Partial<EntityResults<T>>,
    public readonly rollContext: RollContext,
    public readonly onAccept: (results: EntityModalResults<T>) => void,
    public readonly onCancel: () => void,
  ) {
    super(plugin.app);
    this.results = {
      createFile: false,
      fileName: "",
      targetFolder: "",
      entity: Object.fromEntries(
        Object.entries(entityDesc.spec).map(([key]) => [
          key,
          initialEntity[key] ?? [],
        ]),
      ) as Record<keyof T, RollWrapper[]>,
    };
    // TODO: populate rolls table from initialEntity. tricky thing is just dealing with
    // the id assignment
    // entity: Object.fromEntries(
    //   Object.entries(entityDesc.spec).map(([key]) => [
    //     key,
    //     (initialEntity[key] ?? []).map((r) => createRollContainer(r)),
    //   ]),
    // ) as Record<keyof T, IRollContainer[]>,
    // this.entityProxy = new Proxy(this.results.entity, {
    //   get(target, p, receiver): RollWrapper[] {
    //     return Reflect.get(target, p, receiver).map((c) =>
    //       c.activeRoll().currentRoll(),
    //     );
    //   },
    // }) as unknown as EntityResults<T>;
  }

  renderRoll(roll: RollContainer, onClick?: (ev: MouseEvent) => void) {
    const activeRoll = roll.activeRoll().currentRoll();
    const resultText = parseDataswornLinks(activeRoll.row.result).map(
      (segment): [string, string] => {
        if (typeof segment == "string") return [segment, segment];
        const { id, label } = segment;
        if (activeRoll.subrolls[id]) {
          return [
            label,
            activeRoll.subrolls[id].rolls
              .map((sr) => sr.simpleResult)
              .join(", "),
          ];
        } else {
          return [label, label];
        }
      },
    );
    const toolTipText = resultText.map(([label, _val]) => label);
    const rowText = resultText.map(([_label, val]) => val);
    return html`<a
      aria-label=${toolTipText}
      data-tooltip-position="top"
      @click=${onClick}
      >${rowText}</a
    >`;
  }

  renderRolls(key: keyof T, id: string, allowEdit: boolean) {
    const keyAndId = `${key as string}:${id}`;
    const rolls = this.rolls.get(keyAndId) ?? [];
    const { label: entityLabel } = this.entityDesc;
    if (rolls.length == 0) return "";

    return html`${join(
      map(rolls, (roll, index) =>
        this.renderRoll(
          roll,
          allowEdit
            ? (ev) => {
                ev.preventDefault();
                ev.stopPropagation();

                new NewOracleRollerModal(
                  this.plugin,
                  roll,
                  (newRoll) => {
                    const newRolls = [...(this.rolls.get(keyAndId) ?? [])];
                    newRolls[index] = newRoll;
                    this.updateSetting(key, id, newRolls);
                  },
                  () => {},
                  [entityLabel],
                ).open();
              }
            : undefined,
        ),
      ),
      html`<span class="separator">; </span>`,
    )}`;
  }

  updateSetting(key: keyof T, id: string, values: RollContainer[]) {
    this.rolls.set(`${key as string}:${id}`, values);
    this.onUpdateRolls();
  }

  async updateRollForKey(
    key: keyof T,
    id: string,
    mode: "append" | "replace",
    allowGraphical: boolean = true,
  ): Promise<void> {
    const keyAndId = `${key as string}:${id}`;
    const currentRolls = this.rolls.get(keyAndId) ?? [];

    const table = this.rollContext.lookup(id);
    if (!table) {
      throw new Error(
        `Unable to find table '${id}' referenced by attribute '${key as string}`,
      );
    }

    const newRoll = createRollContainer(
      new RollWrapper(
        table,
        this.rollContext,
        allowGraphical
          ? await table.roll(this.rollContext)
          : table.rollDirect(this.rollContext),
      ),
    );

    this.updateSetting(
      key,
      id,
      mode == "append" ? [...currentRolls, newRoll] : [newRoll],
    );
  }

  onUpdateRolls() {
    this.updateActiveSlots();

    const newEntityName =
      this.entityDesc.nameGen && this.entityDesc.nameGen(this.results.entity);
    if (newEntityName !== undefined) {
      this.fileNameInput.setValue(newEntityName);
      this.fileNameInput.onChanged();
    }

    this.render();
  }

  fileNameInput!: TextComponent;

  async onOpen(): Promise<void> {
    const { contentEl } = this;

    contentEl.toggleClass("iron-vault-modal", true);

    const { label: entityLabel } = this.entityDesc;

    new Setting(contentEl).setName(entityLabel).setHeading();

    this.attributesEl = contentEl.createDiv();

    const commandSetting = new Setting(contentEl);
    if (
      Object.values(this.entityDesc.spec).some(({ firstLook }) => firstLook)
    ) {
      commandSetting.addButton((btn) =>
        btn.setButtonText("Roll first look").onClick(async () => {
          this.rolls.clear();
          this.onUpdateRolls();
          for (const [key, spec] of Object.entries(this.entityDesc.spec)) {
            if (spec.firstLook) {
              // We check if the key is in activeSlots after each roll, rather than just iterating
              // through active slots, because each call to updateRoll could change an active
              // slot
              const [, activeSpec] = this.activeSlots.find(
                ([activeKey, _spec]) => activeKey === key,
              ) ?? [undefined, undefined];
              if (activeSpec) {
                await this.updateRollForKey(
                  key as string,
                  activeSpec.id,
                  "replace",
                );
              }
            }
          }
        }),
      );
    }
    commandSetting.addButton((btn) =>
      btn.setButtonText("Clear").onClick(() => {
        this.rolls.clear();
        this.onUpdateRolls();
      }),
    );

    const updateAccept = () => {
      acceptButton.setDisabled(
        this.results.createFile && this.results.fileName.length == 0,
      );
    };

    const onCreateFileChange = (val: boolean) => {
      this.results.createFile = val;
      fileNameSetting.settingEl.toggle(val);
      targetFolderSetting.settingEl.toggle(val);
      updateAccept();
    };

    new Setting(contentEl)
      .setName("Create entity file")
      .addToggle((toggle) =>
        toggle
          .setTooltip(
            "If enabled, a new file will be created with the entity template.",
          )
          .setValue(this.results.createFile)
          .onChange(onCreateFileChange),
      );

    const fileNameSetting = new Setting(contentEl)
      .setName("File name")
      .addText((text) =>
        (this.fileNameInput = text).onChange((value) => {
          this.results.fileName = value;
          updateAccept();
        }),
      );

    const targetFolderSetting = new Setting(contentEl)
      .setName("Target folder")
      .addSearch((search) => {
        new FolderTextSuggest(this.app, search.inputEl);

        search
          .setPlaceholder("Choose a folder")
          .setValue(this.results.targetFolder)
          .onChange((newFolder) => {
            const normalized = normalizePath(newFolder);
            this.results.targetFolder = normalized;
            if (this.app.vault.getFolderByPath(normalized)) {
              targetFolderSetting.setDesc(
                `Creating ${this.entityDesc.label} in existing folder '${normalized}'`,
              );
            } else {
              targetFolderSetting.setDesc(
                `Creating ${this.entityDesc.label} in new folder '${normalized}`,
              );
            }
          });
      });

    let acceptButton!: ButtonComponent;
    new Setting(contentEl)
      .addButton((btn) =>
        (acceptButton = btn)
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

    this.onUpdateRolls();
    onCreateFileChange(this.results.createFile);
  }

  calculateAttributeValues() {
    const attributeValues: Partial<Record<keyof T, string>> = {};

    for (const [key, spec] of (
      Object.entries(this.entityDesc.spec) as [keyof T, EntityFieldSpec][]
    ).filter((elem): elem is [keyof T, EntityAttributeFieldSpec] =>
      isEntityAttributeSpec(elem[1]),
    )) {
      const id = evaluateSlotId(spec.id, (attrid) => attributeValues[attrid]);
      if (id) {
        const rolls = this.rolls.get(`${key as string}:${id}`);
        if (rolls && rolls.length > 0) {
          if (attributeValues[key])
            logger.warn(
              "Something already set %s to %o",
              key,
              attributeValues[key],
            );

          attributeValues[key] = evaluateAttribute(
            spec,
            rolls.map((c) => c.activeRoll().currentRoll()),
          );
        }
      } else {
        logger.debug(
          "For attribute %s = %o, missing attribute dep for %s",
          key,
          spec,
          spec.id,
        );
      }
    }

    return attributeValues;
  }

  updateActiveSlots() {
    const attributeValues = this.calculateAttributeValues();

    const activeSlots: [keyof T, EntityFieldSpec][] = [];
    const currentEntity: Partial<EntityResults<T>> = {};

    for (const [key, slot] of Object.entries(this.entityDesc.spec) as [
      keyof T,
      EntityFieldSpec,
    ][]) {
      const formattedId = evaluateSlotId(
        slot.id,
        (attrid) => attributeValues[attrid],
      );

      // We don't have the parameters for this or it is excluded by condition, so it can't be included.
      if (
        !formattedId ||
        (slot.condition &&
          !slot.condition.find((reqs) =>
            hasAllProperties(reqs, attributeValues),
          ))
      ) {
        currentEntity[key] = [];
        continue;
      }

      activeSlots.push([key, { ...slot, id: formattedId }]);
      currentEntity[key] = (
        this.rolls.get(`${key as string}:${formattedId}`) ?? []
      ).map((r) => r.activeRoll().currentRoll());
    }

    this.activeSlots = activeSlots;
    this.results.entity = currentEntity as EntityResults<T>; // safe: we will have filled in every key at this point
  }

  render() {
    render(
      repeat(
        this.activeSlots,
        // Because we use the id in the key, we can be sure that the tables for a key won't change
        // any of the oracle-linked properties built-in below.
        ([key, { id }]) => `${key as string}:${id}`,
        ([key, { id, name }]) => {
          const table = this.rollContext.lookup(id);
          if (!table) {
            return html`<div>Missing table ${id} for attribute ${key}</div>`;
          }

          const isReRollerOracle = (table.recommended_rolls?.max ?? 0) > 1;

          let description = name ?? table.name;
          if (isReRollerOracle) {
            description = `${description} (Rolls: ${table.recommended_rolls?.min} - ${table.recommended_rolls?.max})`;
          }

          return html`<div class="setting-item" data-key=${key} data-id=${id}>
            <div class="setting-item-info">
              <div class="setting-item-name">
                ${this.renderRolls(key as string, id, true)}
              </div>
              <div
                class="setting-item-description"
                aria-label=${`(id: ${table.id})`}
              >
                ${description}
              </div>
            </div>

            ${guard(
              [key, id],
              () =>
                html`<div
                  class="setting-item-control"
                  ${ref((el) => {
                    if (el === undefined) return;
                    if (!(el instanceof HTMLElement))
                      throw new Error(`expected el to be HTMLElement, ${el}`);
                    const rollBtn = new ExtraButtonComponent(el)
                      .setIcon("dices")
                      .onClick(() => {
                        this.updateRollForKey(
                          key,
                          id,
                          isReRollerOracle ? "append" : "replace",
                        );
                        if (isReRollerOracle) {
                          rollBtn.setIcon("rotate-cw");
                        }
                      });
                    new ExtraButtonComponent(el)
                      .setIcon("delete")
                      .onClick(() => {
                        this.updateSetting(key, id, []);
                      });
                  })}
                ></div>`,
            )}
          </div>`;
        },
      ),
      this.attributesEl,
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
