import { PlaysetConfig } from "campaigns/playsets/config";
import { STANDARD_PLAYSET_DEFNS } from "campaigns/playsets/standard";
import IronVaultPlugin from "index";
import isMatch from "lodash.ismatch";
import { rootLogger } from "logger";
import { Setting, ToggleComponent } from "obsidian";
import { DELVE_LOGO, IS_LOGO, SF_LOGO, SI_LOGO } from "utils/logos";
import { PlaysetEditor } from "./playset-editor";

const logger = rootLogger.getLogger("playset-setting");

/** Settings config states for playset options. */
type PlaysetState = {
  base: "classic" | "starforged" | "sundered_isles" | "custom";
  classicIncludeDelve: boolean;
  starforgedIncludeSunderedIslesRecommended: boolean;
  sunderedIslesIncludeTechnologicalAssets: boolean;
  sunderedIslesIncludeSupernaturalAssets: boolean;
  customPlaysetChoice: string | null;
  customConfig: string;
};

const STANDARD_PLAYSET_SETTINGS: Record<
  keyof typeof STANDARD_PLAYSET_DEFNS,
  Partial<PlaysetState>
> = {
  classic: {
    base: "classic",
    classicIncludeDelve: false,
  },
  classic_delve: {
    base: "classic",
    classicIncludeDelve: true,
  },
  starforged: {
    base: "starforged",
    starforgedIncludeSunderedIslesRecommended: false,
  },
  starforged__si_assets: {
    base: "starforged",
    starforgedIncludeSunderedIslesRecommended: true,
  },
  sundered_isles__assets_all: {
    base: "sundered_isles",
    sunderedIslesIncludeSupernaturalAssets: true,
    sunderedIslesIncludeTechnologicalAssets: true,
  },
  sundered_isles__assets_historical: {
    base: "sundered_isles",
    sunderedIslesIncludeSupernaturalAssets: false,
    sunderedIslesIncludeTechnologicalAssets: false,
  },
  sundered_isles__assets_supernatural: {
    base: "sundered_isles",
    sunderedIslesIncludeSupernaturalAssets: true,
    sunderedIslesIncludeTechnologicalAssets: false,
  },
  sundered_isles__assets_technological: {
    base: "sundered_isles",
    sunderedIslesIncludeSupernaturalAssets: false,
    sunderedIslesIncludeTechnologicalAssets: true,
  },
};

export class PlaysetSetting {
  playsetState: PlaysetState = {
    base: "classic",
    classicIncludeDelve: false,
    starforgedIncludeSunderedIslesRecommended: false,
    sunderedIslesIncludeTechnologicalAssets: true,
    sunderedIslesIncludeSupernaturalAssets: true,
    customConfig: "",
    customPlaysetChoice: null,
  };

  changeCallback?: (setting: this) => void | Promise<void>;

  private readonly updatePlaysetState: (updates: Partial<PlaysetState>) => void;

  constructor(
    readonly plugin: IronVaultPlugin,
    readonly contentEl: HTMLElement,
  ) {
    const toggles: Record<string, ToggleComponent> = {};
    const subToggleSettings: Record<string, Setting[]> = {
      classic: [],
      starforged: [],
      sundered_isles: [],
      custom: [],
    };
    const subToggles: Record<string, ToggleComponent> = {};

    let updatingState = false;
    this.updatePlaysetState = (updates: Partial<PlaysetState>) => {
      if (updatingState) {
        return;
      }

      updatingState = true;
      try {
        Object.assign(this.playsetState, updates);
        for (const [key, toggle] of Object.entries(toggles)) {
          const thisKeySelected = key == this.playsetState.base;
          if (toggle.getValue() != thisKeySelected) {
            toggle.setValue(thisKeySelected);
          }
          toggle.setDisabled(thisKeySelected);
          for (const subToggle of subToggleSettings[key]) {
            subToggle.setDisabled(!thisKeySelected);
          }
        }
        for (const [key, toggle] of Object.entries(subToggles)) {
          const stateVal = (this.playsetState as Record<string, unknown>)[key];
          if (typeof stateVal == "boolean" && stateVal !== toggle.getValue()) {
            toggle.setValue(stateVal);
          }
        }

        this.changeCallback?.(this);
      } finally {
        updatingState = false;
      }
    };

    new Setting(contentEl)
      .setName("Playset")
      .setDesc(
        "The playset selects the content from the official rulebooks and from your " +
          "configured Homebrew to make available in this campaign.",
      )
      .setHeading();

    new Setting(contentEl)
      .setName("Ironsworn")
      .addToggle((toggle) => {
        toggle.onChange((val) => {
          if (val) {
            this.updatePlaysetState({ base: "classic" });
          }
        });
        toggles["classic"] = toggle;
      })
      .then((setting) => {
        const isImg = document.createElement("img");
        isImg.src = IS_LOGO;
        isImg.toggleClass("ruleset-img", true);
        setting.settingEl.prepend(isImg);
      });

    new Setting(contentEl)
      .setDesc("Include Delve expansion")
      .setClass("iv-sub-setting")
      .addToggle((toggle) => {
        toggle.onChange((value) =>
          this.updatePlaysetState({ classicIncludeDelve: value }),
        );
        subToggles["classicIncludeDelve"] = toggle;
      })
      .then((delveSetting) => {
        const delveImg = document.createElement("img");
        delveImg.src = DELVE_LOGO;
        delveImg.toggleClass("ruleset-img", true);
        delveSetting.settingEl.prepend(delveImg);

        subToggleSettings["classic"].push(delveSetting);
      });

    new Setting(contentEl)
      .setName("Starforged")
      .addToggle((toggle) => {
        toggle.onChange((val) => {
          if (val) {
            this.updatePlaysetState({ base: "starforged" });
          }
        });
        toggles["starforged"] = toggle;
      })
      .then((sfSetting) => {
        const sfImg = document.createElement("img");
        sfImg.src = SF_LOGO;
        sfImg.toggleClass("ruleset-img", true);
        sfSetting.settingEl.prepend(sfImg);
      });

    new Setting(contentEl)
      .setDesc("Include Sundered Isles assets recommended for the base game")
      .setClass("iv-sub-setting")
      .addToggle((toggle) => {
        toggle.onChange((val) => {
          this.updatePlaysetState({
            starforgedIncludeSunderedIslesRecommended: val,
          });
        });
        subToggles["starforgedIncludeSunderedIslesRecommended"] = toggle;
      })
      .then((setting) => {
        subToggleSettings["starforged"].push(setting);
      });

    new Setting(contentEl)
      .setName("Sundered Isles")
      .addToggle((toggle) => {
        toggle.onChange((val) => {
          if (val) {
            this.updatePlaysetState({ base: "sundered_isles" });
          }
        });

        toggles["sundered_isles"] = toggle;
      })
      .then((siSetting) => {
        const siImg = document.createElement("img");
        siImg.src = SI_LOGO;
        siImg.toggleClass("ruleset-img", true);
        siSetting.settingEl.prepend(siImg);
      });

    new Setting(contentEl)
      .setDesc(
        "Include 'technological' assets from Starforged and Sundered Isles",
      )
      .setClass("iv-sub-setting")
      .addToggle((toggle) => {
        toggle.onChange((val) => {
          this.updatePlaysetState({
            sunderedIslesIncludeTechnologicalAssets: val,
          });
        });
        subToggles["sunderedIslesIncludeTechnologicalAssets"] = toggle;
      })
      .then((setting) => {
        subToggleSettings["sundered_isles"].push(setting);
      });
    new Setting(contentEl)
      .setDesc(
        "Include 'supernatural' assets from Starforged and Sundered Isles",
      )
      .setClass("iv-sub-setting")
      .addToggle((toggle) => {
        toggle.onChange((val) => {
          this.updatePlaysetState({
            sunderedIslesIncludeSupernaturalAssets: val,
          });
        });
        subToggles["sunderedIslesIncludeSupernaturalAssets"] = toggle;
      })
      .then((setting) => {
        subToggleSettings["sundered_isles"].push(setting);
      });

    new Setting(contentEl)
      .setName("Custom")
      .setDesc("Define your own playset and customize the content you include")

      .addButton((button) => {
        button
          .setButtonText("Configure")
          .onClick(async () => {
            const { playset, customConfig } = await PlaysetEditor.open(
              this.plugin.app,
              this.plugin.datastore.indexer,
              this.playsetKey(),
              this.playsetState.customConfig,
            );

            this.setFromKeyAndConfig(playset, customConfig);
          })
          .setTooltip("View playsets or configure a custom playset");
      })
      .addToggle((toggle) => {
        toggle.onChange((val) => {
          if (val) {
            this.updatePlaysetState({ base: "custom" });
          }
        });

        toggles["custom"] = toggle;
      });
  }

  playsetKey(): string {
    if (this.playsetState.base == "custom") {
      return this.playsetState.customPlaysetChoice ?? "custom";
    } else {
      const standardPlayset = Object.entries(STANDARD_PLAYSET_SETTINGS).find(
        ([_key, settings]) => isMatch(this.playsetState, settings),
      );
      if (standardPlayset) {
        return standardPlayset[0];
      } else {
        logger.warn("Unable to determine playset for configuration");
        return "custom";
      }
    }
  }

  setFromKeyAndConfig(playset: string, customConfig: string) {
    if (playset == "custom") {
      this.updatePlaysetState({
        base: "custom",
        customConfig,
        customPlaysetChoice: null,
      });
    } else {
      const standardSettings = Object.entries(STANDARD_PLAYSET_SETTINGS).find(
        ([standardPlayset]) => standardPlayset === playset,
      );
      if (standardSettings) {
        this.updatePlaysetState(standardSettings[1]);
      } else {
        this.updatePlaysetState({
          base: "custom",
          customPlaysetChoice: playset,
        });
      }
    }
  }

  /** Determines if this is a valid playset setting. */
  isValid(): boolean {
    if (this.playsetState.base == "custom") {
      try {
        PlaysetConfig.parseFile(this.playsetState.customConfig);
      } catch (e) {
        return false;
      }
    }

    return true;
  }

  onChange(cb?: (setting: this) => void | Promise<void>): this {
    this.changeCallback = cb;
    return this;
  }

  get customConfig(): string {
    return this.playsetState.customConfig;
  }
}
