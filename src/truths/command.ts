import { CampaignDataContext } from "campaigns/context";
import { determineCampaignContext } from "campaigns/manager";
import Handlebars from "handlebars";

import IronVaultPlugin from "index";
import {
  App,
  MarkdownFileInfo,
  MarkdownView,
  Modal,
  SearchComponent,
  Setting,
  normalizePath,
} from "obsidian";
import { getExistingOrNewFolder } from "utils/obsidian";
import { FolderTextSuggest } from "utils/ui/settings/folder";

export async function generateTruthsCommand(
  plugin: IronVaultPlugin,
  view?: MarkdownView | MarkdownFileInfo,
  defaultTargetFolder?: string,
  defaultFileName?: string,
) {
  const campaignContext: CampaignDataContext = await determineCampaignContext(
    plugin,
    view,
  );
  const truths = [...campaignContext.truths.values()];
  const text = Handlebars.compile(
    `{{#each truths}}\n## {{name}}\n\`\`\`iron-vault-truth\n{{_id}}\n\`\`\`\n\n{{/each}}`,
  )({ truths });
  const { fileName, targetFolder }: { fileName: string; targetFolder: string } =
    defaultFileName && defaultTargetFolder
      ? { fileName: defaultFileName, targetFolder: defaultTargetFolder }
      : await new Promise((onAccept, onReject) =>
          new GenerateTruthsModal(
            plugin.app,
            { targetFolder: "" },
            onAccept,
            onReject,
          ).open(),
        );
  const file = await plugin.app.fileManager.createNewMarkdownFile(
    await getExistingOrNewFolder(plugin.app, targetFolder),
    fileName,
    text,
  );
  plugin.app.workspace.getLeaf(false).openFile(file);
}

type GenerateTruthsResultType = {
  fileName: string;
  targetFolder: string;
};

class GenerateTruthsModal extends Modal {
  public result: GenerateTruthsResultType = {
    fileName: "",
    targetFolder: "",
  };

  public accepted: boolean = false;

  constructor(
    app: App,
    defaults: Partial<GenerateTruthsResultType> = {},
    protected readonly onAccept: (arg: {
      targetFolder: string;
      fileName: string;
    }) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
    Object.assign(this.result, defaults);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName("New Truths file").setHeading();

    new Setting(contentEl).setName("File name").addText((text) =>
      text.onChange((value) => {
        this.result.fileName = value;
      }),
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
            this.result.targetFolder = newFolder;
            const normalized = normalizePath(newFolder);
            if (this.app.vault.getFolderByPath(normalized)) {
              folderSetting.setDesc(
                `Creating Truths file in existing folder '${normalized}'`,
              );
            } else {
              folderSetting.setDesc(
                `Creating Truths file in new folder '${normalized}`,
              );
            }
          });
      });

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
      fileName: this.result.fileName,
      targetFolder: this.result.targetFolder,
    });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
