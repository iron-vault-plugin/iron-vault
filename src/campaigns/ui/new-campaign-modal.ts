import { PlaysetConfig } from "campaigns/playsets/config";
import { STANDARD_PLAYSET_DEFNS } from "campaigns/playsets/standard";
import IronVaultPlugin from "index";
import isMatch from "lodash.ismatch";
import { rootLogger } from "logger";
import {
  ButtonComponent,
  Modal,
  normalizePath,
  Setting,
  TextComponent,
  TFile,
  TFolder,
  ToggleComponent,
} from "obsidian";
import { DELVE_LOGO, IS_LOGO, SF_LOGO, SI_LOGO } from "utils/logos";
import { FolderTextSuggest } from "utils/ui/settings/folder";
import { PlaysetEditor } from "./playset-editor";

const logger = rootLogger.getLogger("new-campaign-modal");

export type NewCampaignInfo = {
  campaignName: string;
  folder: string;
  scaffold: boolean;
  playsetOption: string;
  customPlaysetDefn: string;
};

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

export class NewCampaignModal extends Modal {
  campaignInfo: NewCampaignInfo = {
    campaignName: "",
    folder: "/",
    scaffold: true,
    playsetOption: "starforged",
    customPlaysetDefn: "",
  };

  playsetState: PlaysetState = {
    base: "classic",
    classicIncludeDelve: false,
    starforgedIncludeSunderedIslesRecommended: false,
    sunderedIslesIncludeTechnologicalAssets: true,
    sunderedIslesIncludeSupernaturalAssets: true,
    customConfig: "",
    customPlaysetChoice: null,
  };

  static show(plugin: IronVaultPlugin): Promise<NewCampaignInfo> {
    return new Promise((resolve, reject) => {
      try {
        new NewCampaignModal(plugin, resolve, reject).open();
      } catch (e) {
        reject(e);
      }
    });
  }

  constructor(
    readonly plugin: IronVaultPlugin,
    private readonly resolve: (results: NewCampaignInfo) => unknown,
    private readonly reject: (e: Error) => unknown,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;

    const validate = () => {
      let valid: boolean = true;

      valid &&= (this.campaignInfo.campaignName ?? "").length > 0;

      // If the playset option is custom, we need a valid non-empty, playset config.
      if (this.campaignInfo.playsetOption == "custom") {
        if (this.campaignInfo.customPlaysetDefn.trim()) {
          try {
            PlaysetConfig.parseFile(this.campaignInfo.customPlaysetDefn);
          } catch (e) {
            valid = false;
          }
        } else {
          valid = false;
        }
      }

      const existing = this.app.vault.getAbstractFileByPath(
        this.campaignInfo.folder,
      );
      if (!existing) {
        resultSetting.setDesc(
          `Campaign will be created in new folder '${this.campaignInfo.folder}'.`,
        );
      } else if (existing instanceof TFolder) {
        resultSetting.setDesc(
          `Campaign will be created in existing folder '${this.campaignInfo.folder}'.`,
        );
      } else if (existing instanceof TFile) {
        resultSetting.setDesc(
          "ERROR: Invalid folder for campaign. File exists at that path.",
        );
        valid = false;
      }

      const campaignFileName = normalizePath(
        this.campaignInfo.folder + "/" + this.campaignInfo.campaignName,
      );
      const existingCampaign =
        this.plugin.campaignManager.campaignForPath(campaignFileName);
      if (existingCampaign) {
        resultSetting.setDesc(
          `ERROR: The folder '${this.campaignInfo.folder}' is part of the campaign at '${existingCampaign.file.path}'. Campaigns may not be nested.`,
        );
        valid = false;
      }

      createButton.setDisabled(!valid);
    };

    new Setting(contentEl).setName("Create a campaign").setHeading();

    new Setting(contentEl)
      .setName("Campaign name")
      .setDesc(
        "A brief name for the campaign. You can change this at any time.",
      )
      .addText((text) =>
        text
          .setPlaceholder("My campaign")
          .setValue(this.campaignInfo.campaignName)
          .onChange((val) => {
            this.campaignInfo.campaignName = val;
            folderInput.setValue(this.campaignInfo.campaignName);
            folderInput.onChanged();
            validate();
          }),
      );

    const DEFAULT_FOLDER_DESC =
      "Folder that houses the campaign. All content under this folder is considered part of the campaign.";

    let folderInput!: TextComponent;
    new Setting(contentEl)
      .setName("Folder")
      .setDesc(DEFAULT_FOLDER_DESC)
      .addText((text) => {
        new FolderTextSuggest(this.app, text.inputEl);

        (folderInput = text)
          .setPlaceholder("/")
          .setValue(
            this.campaignInfo.folder == "/" ? "" : this.campaignInfo.folder,
          )
          .onChange(async (val) => {
            this.campaignInfo.folder = normalizePath(val);
            validate();
          });
      });

    const resultSetting = new Setting(contentEl).setDesc("X will be Y.");

    const toggles: Record<string, ToggleComponent> = {};
    const subToggleSettings: Record<string, Setting[]> = {
      classic: [],
      starforged: [],
      sundered_isles: [],
      custom: [],
    };
    const subToggles: Record<string, ToggleComponent> = {};

    let updatingState = false;
    const updatePlaysetState = (updates: Partial<PlaysetState>) => {
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

        if (this.playsetState.base == "custom") {
          this.campaignInfo.playsetOption =
            this.playsetState.customPlaysetChoice ?? "custom";
          this.campaignInfo.customPlaysetDefn = this.playsetState.customConfig;
        } else {
          const standardPlayset = Object.entries(
            STANDARD_PLAYSET_SETTINGS,
          ).find(([_key, settings]) => isMatch(this.playsetState, settings));
          if (standardPlayset) {
            this.campaignInfo.playsetOption = standardPlayset[0];
          } else {
            logger.warn("Unable to determine playset for configuration");
            this.campaignInfo.playsetOption = "custom";
            this.campaignInfo.customPlaysetDefn =
              this.playsetState.customConfig;
          }
        }

        validate();
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
            updatePlaysetState({ base: "classic" });
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
          updatePlaysetState({ classicIncludeDelve: value }),
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
            updatePlaysetState({ base: "starforged" });
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
          updatePlaysetState({
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
            updatePlaysetState({ base: "sundered_isles" });
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
          updatePlaysetState({
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
          updatePlaysetState({
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
              this.app,
              this.plugin.datastore.indexer,
              this.campaignInfo.playsetOption,
              this.campaignInfo.customPlaysetDefn,
            );

            if (playset == "custom") {
              updatePlaysetState({
                base: "custom",
                customConfig,
                customPlaysetChoice: null,
              });
            } else {
              const standardSettings = Object.entries(
                STANDARD_PLAYSET_SETTINGS,
              ).find(([standardPlayset]) => standardPlayset === playset);
              if (standardSettings) {
                updatePlaysetState(standardSettings[1]);
              } else {
                updatePlaysetState({
                  base: "custom",
                  customPlaysetChoice: playset,
                });
              }
            }
          })
          .setTooltip("View playsets or configure a custom playset");
      })
      .addToggle((toggle) => {
        toggle.onChange((val) => {
          if (val) {
            updatePlaysetState({ base: "custom" });
          }
        });

        toggles["custom"] = toggle;
      });

    new Setting(contentEl)
      .setName("Scaffold campaign")
      .setDesc(
        "Should some default files and folders, such as entity folders, truths, etc, be auto-generated on campaign creation? You will be prompted about a new character.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.campaignInfo.scaffold).onChange((val) => {
          this.campaignInfo.scaffold = val;
        });
      });

    let createButton!: ButtonComponent;
    new Setting(contentEl)
      .addButton((btn) =>
        (createButton = btn)
          .setCta()
          .setButtonText("Create")
          .onClick(() => {
            this.resolve(this.campaignInfo);
            this.close();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close()),
      );

    updatePlaysetState({ base: "starforged" });
  }

  onClose(): void {
    this.reject(new Error("user cancelled"));
  }
}
