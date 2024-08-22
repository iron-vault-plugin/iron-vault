import { CampaignFile } from "campaigns/entity";
import IronVaultPlugin from "index";
import {
  AbstractInputSuggest,
  App,
  ButtonComponent,
  FuzzyMatch,
  Modal,
  Setting,
  TextComponent,
  debounce,
  prepareFuzzySearch,
} from "obsidian";
import { generateObsidianFilename } from "utils/filename";
import { capitalize } from "utils/strings";
import { processMatches } from "utils/suggest";
import { CampaignSelectComponent } from "utils/ui/settings/campaign-suggest";
import { RelativeFolderSearchComponent } from "utils/ui/settings/relative-folder-search";
import { Clock } from "./clock";
import { ClockOdds, STANDARD_ODDS } from "./clock-file";

export type ClockCreateResultType = {
  segments: number;
  name: string;
  fileName: string;
  targetFolder: string;
  defaultOdds: ClockOdds | undefined;
};

export class ClockCreateModal extends Modal {
  public result: ClockCreateResultType = {
    segments: 6,
    name: "",
    fileName: "",
    targetFolder: "",
    defaultOdds: "no roll",
  };

  public accepted: boolean = false;

  static async show(plugin: IronVaultPlugin): Promise<{
    name: string;
    targetFolder: string;
    fileName: string;
    defaultOdds: ClockOdds | undefined;
    clock: Clock;
  }> {
    return await new Promise((onAccept, onReject) => {
      try {
        new ClockCreateModal(plugin, {}, onAccept, onReject).open();
      } catch (e) {
        onReject(e);
      }
    });
  }

  constructor(
    readonly plugin: IronVaultPlugin,
    defaults: Partial<ClockCreateResultType> = {},
    protected readonly onAccept: (arg: {
      name: string;
      targetFolder: string;
      fileName: string;
      defaultOdds: ClockOdds | undefined;
      clock: Clock;
    }) => void,
    protected readonly onCancel: () => void,
  ) {
    super(plugin.app);
    Object.assign(this.result, defaults);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName("New clock").setHeading();

    let campaign!: CampaignFile;

    const onChangeCampaign = () => {
      //TODO(@cwegrzyn): this should update to use the campaign-specific folder
      folderComponent
        .setBaseFolder(campaign.file.parent!)
        .setValue(this.plugin.settings.defaultClockFolder)
        .onChanged();
    };

    const validate = debounce(() => {
      const valid =
        this.result.name.trim().length > 0 &&
        this.result.fileName.trim().length > 0 &&
        this.result.defaultOdds != null;
      createButton.setDisabled(!valid);
    }, 0);

    CampaignSelectComponent.addToSetting(
      new Setting(contentEl)
        .setName("Campaign")
        .setDesc("New clock will be created in this campaign."),
      this.plugin,
      (dropdown) => {
        dropdown.onChange((val) => {
          campaign = val;
          onChangeCampaign();
          validate();
        });
        campaign = dropdown.getValue();
      },
    );

    new Setting(contentEl).setName("Name").addText((text) =>
      text.onChange((value) => {
        this.result.name = value;
        // TODO: could add smarter logic to only update if user hasn't made a specific value
        fileNameText.setValue(generateObsidianFilename(value)).onChanged();
        validate();
      }),
    );

    let fileNameText!: TextComponent;
    new Setting(contentEl).setName("File name").addText(
      (text) =>
        (fileNameText = text.onChange((value) => {
          this.result.fileName = value;
          validate();
        })),
    );

    let folderComponent!: RelativeFolderSearchComponent;
    const folderSetting = RelativeFolderSearchComponent.addToSetting(
      new Setting(contentEl).setName("Target folder"),
      this.plugin.app,
      (search) => {
        folderComponent = search
          .setPlaceholder("Choose a folder")
          .setValue(this.result.targetFolder)
          .onChange((_relPath, newPath, folder) => {
            this.result.targetFolder = newPath;
            if (folder) {
              folderSetting.setDesc(
                `Creating clock in existing folder '${newPath}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating clock in new folder '${newPath}'`,
              );
            }
          });
      },
    );

    new Setting(contentEl).setName("Segments").addSlider((slider) =>
      slider
        .setLimits(2, 12, 1)
        .setValue(this.result.segments)
        .setDynamicTooltip()
        .onChange((segments) => {
          this.result.segments = segments;
        }),
    );

    const frag = new DocumentFragment();
    frag.append(
      "Default odds to roll when advancing this clock.",
      document.createElement("br"),
      "Choose 'no roll' if this clock should advance unconditionally (without prompting).",
    );
    new Setting(contentEl)
      .setName("Default odds")
      .setDesc(frag)
      .addSearch((search) => {
        new OddsSuggest(this.app, search.inputEl);

        search
          .setValue(String(this.result.defaultOdds ?? ""))
          .onChange((newOdds) => {
            newOdds = newOdds.toLowerCase();
            if (newOdds in STANDARD_ODDS) {
              this.result.defaultOdds = newOdds as keyof typeof STANDARD_ODDS;
            } else if (newOdds == "no roll") {
              this.result.defaultOdds = "no roll";
            } else {
              this.result.defaultOdds = undefined;
            }
            validate();
          });
      });

    onChangeCampaign();
    validate();

    let createButton!: ButtonComponent;
    new Setting(contentEl)
      .addButton((btn) =>
        (createButton = btn)
          .setButtonText("Create")
          .setCta()
          .onClick(() => {
            this.accept();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.accepted = false;
          this.close();
        }),
      );
  }

  accept(): void {
    this.accepted = true;
    this.close();
    this.onAccept({
      ...this.result,
      clock: Clock.create({
        name: this.result.name,
        progress: 0,
        segments: this.result.segments,
        active: true,
      }).unwrap(),
    });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}

export class OddsSuggest extends AbstractInputSuggest<FuzzyMatch<string>> {
  readonly items = [...Object.keys(STANDARD_ODDS), "no roll"];

  constructor(
    app: App,
    readonly inputEl: HTMLInputElement,
  ) {
    super(app, inputEl);
  }

  getSuggestions(inputStr: string): FuzzyMatch<string>[] {
    const numberValue = Number.parseInt(inputStr);
    if (!Number.isNaN(numberValue)) {
      if (numberValue >= 0 && numberValue <= 100) {
        return [
          { item: numberValue.toString(), match: { matches: [], score: 100 } },
        ];
      } else {
        return [];
      }
    }
    const searchFn = prepareFuzzySearch(inputStr);
    return this.items
      .flatMap((item) => {
        const match = searchFn(item);
        if (match) {
          return [{ item, match }];
        } else {
          return [];
        }
      })
      .sort((a, b) => a.match.score - b.match.score);
  }

  renderSuggestion({ item, match }: FuzzyMatch<string>, el: HTMLElement): void {
    if (item == null) return;

    el.createDiv(undefined, (div) => {
      processMatches(
        capitalize(item),
        match,
        (text) => {
          div.appendText(text);
        },
        (text) => {
          div.createEl("strong", { text });
        },
      );

      if (item.toLowerCase() in STANDARD_ODDS) {
        div.appendText(
          ` (${(STANDARD_ODDS as Record<string, number>)[item.toLowerCase()]}%)`,
        );
      }
    });
    // if (renderExtras != null) {
    //   renderExtras(match, el);
    // }
  }

  selectSuggestion({ item }: FuzzyMatch<string>): void {
    this.setValue(item);
    if (this.inputEl.instanceOf(HTMLInputElement))
      this.inputEl.trigger("input");
    this.close();
  }
}
