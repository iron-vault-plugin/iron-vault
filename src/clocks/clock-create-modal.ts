import {
  App,
  Modal,
  SearchComponent,
  Setting,
  TextComponent,
  normalizePath,
} from "obsidian";
import { generateObsidianFilename } from "utils/filename";
import { FolderTextSuggest } from "utils/ui/settings/folder";
import { Clock } from "./clock";

export type ClockCreateResultType = {
  segments: number;
  name: string;
  fileName: string;
  targetFolder: string;
};

export class ClockCreateModal extends Modal {
  public result: ClockCreateResultType = {
    segments: 6,
    name: "",
    fileName: "",
    targetFolder: "",
  };

  public accepted: boolean = false;

  constructor(
    app: App,
    defaults: Partial<ClockCreateResultType> = {},
    protected readonly onAccept: (arg: {
      name: string;
      targetFolder: string;
      fileName: string;
      clock: Clock;
    }) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
    Object.assign(this.result, defaults);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName("New clock").setHeading();

    let fileNameText: TextComponent;

    new Setting(contentEl).setName("Name").addText((text) =>
      text.onChange((value) => {
        this.result.name = value;
        // TODO: could add smarter logic to only update if user hasn't made a specific value
        fileNameText.setValue(generateObsidianFilename(value)).onChanged();
      }),
    );

    new Setting(contentEl).setName("File name").addText(
      (text) =>
        (fileNameText = text.onChange((value) => {
          this.result.fileName = value;
        })),
    );

    let folderComponent!: SearchComponent;
    const folderSetting = new Setting(contentEl)
      .setName("Target folder")
      .addSearch((search) => {
        new FolderTextSuggest(this.app, search.inputEl);

        folderComponent = search
          .setPlaceholder("Choose a folder")
          .setValue(this.result.targetFolder)
          .onChange((newFolder) => {
            const normalized = normalizePath(newFolder);
            this.result.targetFolder = normalized;
            if (this.app.vault.getFolderByPath(normalized)) {
              folderSetting.setDesc(
                `Creating clock in existing folder '${normalized}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating clock in new folder '${normalized}`,
              );
            }
          });
      });

    new Setting(contentEl).setName("Segments").addSlider((slider) =>
      slider
        .setLimits(2, 12, 1)
        .setValue(this.result.segments)
        .setDynamicTooltip()
        .onChange((segments) => {
          this.result.segments = segments;
        }),
    );

    folderComponent.onChanged();

    new Setting(contentEl)
      .addButton((btn) =>
        btn
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
      name: this.result.name,
      fileName: this.result.fileName,
      targetFolder: this.result.targetFolder,
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
