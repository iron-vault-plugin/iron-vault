import { CampaignDataContext } from "campaigns/context";
import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import { Setting, ValueComponent } from "obsidian";

export class NoCharacterError extends Error {}

export class CharacterSelectComponent extends ValueComponent<string> {
  #dropdownEl: HTMLSelectElement;
  #currentValue: string = "";
  #campaignContext?: CampaignDataContext;
  #changeCallback?: (path: string) => unknown;
  #options: {
    allowEmpty: boolean;
    defaultToActiveCharacter: boolean;
  } = {
    allowEmpty: false,
    defaultToActiveCharacter: true,
  };

  static addToSetting(
    setting: Setting,
    plugin: IronVaultPlugin,
    callback: (select: CharacterSelectComponent) => unknown,
  ): Setting {
    const component = new CharacterSelectComponent(setting.controlEl, plugin);
    setting.components.push(component);
    callback(component);
    return setting;
  }

  constructor(
    readonly containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
  ) {
    super();
    this.#dropdownEl = containerEl.createEl("select", {
      cls: "dropdown",
    });
    this.#dropdownEl.addEventListener("change", this.onChanged);
  }

  defaultToActiveCharacter(defaultToActiveCharacter: boolean): this {
    this.#options.defaultToActiveCharacter = defaultToActiveCharacter;
    return this;
  }

  allowEmpty(allowEmpty: boolean): this {
    this.#options.allowEmpty = allowEmpty;
    return this;
  }

  setCampaignContext(campaignContext: CampaignDataContext | undefined): this {
    if (this.#campaignContext === campaignContext) {
      return this;
    }
    this.#campaignContext = campaignContext;

    const availableCharacters = this.availableCharacters();
    if (this.#options.defaultToActiveCharacter || !this.#options.allowEmpty) {
      const activeCharacter = campaignContext?.localSettings.activeCharacter;
      if (activeCharacter) {
        this.#currentValue = activeCharacter;
      } else if (availableCharacters.length == 1) {
        this.#currentValue = availableCharacters[0][0];
      } else {
        this.#currentValue = "";
      }
    } else {
      this.#currentValue = "";
    }

    if (!this.updateOptions()) this.#changeCallback?.(this.#currentValue);

    return this;
  }

  updateOptions(): boolean {
    this.#dropdownEl.empty();
    let foundCurrent = false;
    if (this.#options.allowEmpty) {
      const option = this.#dropdownEl.createEl("option", {
        value: "",
        text: "No Character",
      });
      if (this.#currentValue === "") {
        option.selected = true;
        foundCurrent = true;
      }
    }
    for (const [path, charContext] of this.availableCharacters()) {
      const option = this.#dropdownEl.createEl("option", {
        value: path,
        text: charContext.getting(charContext.lens.name),
      });
      if (path === this.#currentValue) {
        option.selected = true;
        foundCurrent = true;
      }
    }
    if (!foundCurrent) {
      this.#dropdownEl.selectedIndex = 0;
      this.#currentValue = this.#dropdownEl.value;
      this.#changeCallback?.(this.#currentValue);
      return true;
    }

    return false;
  }

  onChanged = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (value === this.#currentValue) {
      return;
    }
    this.#currentValue = value;
    this.#changeCallback?.(this.#currentValue);
  };

  availableCharacters() {
    if (!this.#campaignContext) {
      return [];
    }
    return [...onlyValid(this.#campaignContext.characters).entries()];
  }

  getValue(): string {
    return this.#currentValue;
  }

  setValue(value: string): this {
    this.#currentValue = value;
    this.#dropdownEl.value = this.#currentValue;
    return this;
  }

  onChange(callback: (value: string) => unknown): this {
    this.#changeCallback = callback;
    return this;
  }
}
