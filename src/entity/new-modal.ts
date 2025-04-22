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
import { NewOracleRollerModal } from "oracles/new-modal";
import { createRollContainer, RollContainer } from "oracles/state";
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
  NewEntityModalResults,
} from "./specs";

const logger = rootLogger.getLogger("entity/new-modal");

export class NewEntityModal<T extends EntitySpec> extends Modal {
  public accepted: boolean = false;
  public readonly results: NewEntityModalResults<T>;
  attributesEl!: HTMLDivElement;
  activeSlots!: [keyof T, EntityFieldSpec][];
  rolls: Map<string, RollContainer[]> = new Map();

  private firstLookButton: ButtonComponent;

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
  }): Promise<NewEntityModalResults<T>> {
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

  protected constructor(
    public plugin: IronVaultPlugin,
    public readonly entityDesc: EntityDescriptor<T>,
    public readonly initialEntity: Partial<EntityResults<T>>,
    public readonly rollContext: RollContext,
    public readonly onAccept: (results: NewEntityModalResults<T>) => void,
    public readonly onCancel: () => void,
  ) {
    super(plugin.app);
    this.results = new NewEntityModalResults(entityDesc);
    // TODO: populate rolls table from initialEntity. tricky thing is just dealing with
    // the id assignment
  }

  /** Updates the rolls in a given slot. */
  setRollsForKey(
    key: keyof T,
    id: string,
    values: RollContainer[],
    mode: "replace" | "append" = "replace",
  ) {
    const keyAndId = `${key as string}:${id}`;
    this.rolls.set(
      keyAndId,
      mode == "append"
        ? [...(this.rolls.get(keyAndId) ?? []), ...values]
        : values,
    );
    this.onUpdateRolls();
  }

  /** Gets the rolls for a given key. */
  getRollsForKey(key: keyof T, id: string): RollContainer[] {
    return this.rolls.get(`${key as string}:${id}`) ?? [];
  }

  /** Updates a slot with a new roll. */
  async addNewRollForKey(
    key: keyof T,
    id: string,
    mode: "append" | "replace",
    allowGraphical: boolean = true,
  ): Promise<void> {
    const newRoll = await this.createNewRoll(id, key, allowGraphical);
    this.setRollsForKey(key, id, [newRoll], mode);
  }

  private async createNewRoll(
    id: string,
    key: keyof T,
    allowGraphical: boolean,
  ) {
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
    return newRoll;
  }

  /** Checks if any first look slots are unfilled. */
  hasUnfilledFirstLookSlots() {
    return this.activeSlots.some(
      ([key, spec]) =>
        spec.firstLook && this.getRollsForKey(key, spec.id).length == 0,
    );
  }

  onUpdateRolls() {
    this.updateActiveSlots();

    if (this.hasUnfilledFirstLookSlots()) {
      this.firstLookButton?.setButtonText("Roll first look");
    } else {
      this.firstLookButton?.setButtonText("Reroll first look");
    }

    this.results.name =
      this.entityDesc.nameGen &&
      this.entityDesc.nameGen(this.results.entityProxy);
    if (this.results.name !== undefined) {
      this.fileNameInput.setValue(this.results.name);
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
        (this.firstLookButton = btn)
          .setButtonText("Roll first look")
          .onClick(async () => {
            // If all first look slots are filled, we are in "re-roll" mode, so clear first.
            if (!this.hasUnfilledFirstLookSlots()) {
              this.rolls.clear();
              this.onUpdateRolls();
            }

            for (const [key, spec] of Object.entries(this.entityDesc.spec)) {
              if (spec.firstLook) {
                // We check if the key is in activeSlots after each roll, rather than just iterating
                // through active slots, because each call to updateRoll could change an active
                // slot
                const [, activeSpec] = this.activeSlots.find(
                  ([activeKey, _spec]) => activeKey === key,
                ) ?? [undefined, undefined];
                if (
                  activeSpec &&
                  this.getRollsForKey(key, activeSpec.id).length == 0
                ) {
                  await this.addNewRollForKey(
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
            rolls.map((c) => c.activeRollWrapper()),
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
        this.results.entity[key] = [];
      } else {
        activeSlots.push([key, { ...slot, id: formattedId }]);
        this.results.entity[key] =
          this.rolls.get(`${key as string}:${formattedId}`) ?? [];
      }
    }

    this.activeSlots = activeSlots;
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
                    new ExtraButtonComponent(el)
                      .setIcon("list")
                      .setTooltip("Pick from table")
                      .onClick(async () => {
                        const currentRolls = this.getRollsForKey(key, id);
                        const initialRoll =
                          currentRolls.length > 0
                            ? currentRolls[currentRolls.length - 1]
                            : await this.createNewRoll(id, key, false);
                        const roll = await this.openRollInModal(initialRoll);
                        if (roll) {
                          this.setRollsForKey(key, id, [roll], "replace");
                        }
                      });
                    const rollBtn = new ExtraButtonComponent(el)
                      .setIcon("dices")
                      .setTooltip("Roll")
                      .onClick(() => {
                        this.addNewRollForKey(
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
                      .setTooltip("Clear")
                      .onClick(() => {
                        this.setRollsForKey(key, id, []);
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

  renderRoll(roll: RollContainer, onClick?: (ev: MouseEvent) => void) {
    const activeRoll = roll.activeRollWrapper();
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

  private _onClickRoll(
    key: keyof T,
    id: string,
    index: number,
    ev: MouseEvent,
  ): void {
    ev.preventDefault();
    ev.stopPropagation();

    this.editRollInModal(key, id, index);
  }

  private async editRollInModal(key: keyof T, id: string, index: number) {
    const keyAndId = `${key as string}:${id}`;
    const rolls = this.rolls.get(keyAndId) ?? [];
    const roll = rolls[index];

    const newRoll = await this.openRollInModal(roll);
    if (newRoll == null) return;

    const newRolls = [...(this.rolls.get(keyAndId) ?? [])];
    newRolls[index] = newRoll;
    this.setRollsForKey(key, id, newRolls);
  }

  private async openRollInModal(
    roll: RollContainer,
  ): Promise<RollContainer | null> {
    return new Promise((resolve) => {
      new NewOracleRollerModal(this.plugin, roll, resolve, () => null, [
        this.entityDesc.label,
      ]).open();
    });
  }

  renderRolls(key: keyof T, id: string, allowEdit: boolean) {
    const keyAndId = `${key as string}:${id}`;
    const rolls = this.rolls.get(keyAndId) ?? [];
    if (rolls.length == 0) return "";

    return html`${join(
      map(rolls, (roll, index) =>
        this.renderRoll(
          roll,
          allowEdit ? this._onClickRoll.bind(this, key, id, index) : undefined,
        ),
      ),
      html`<span class="separator">; </span>`,
    )}`;
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
