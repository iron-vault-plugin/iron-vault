import { CampaignFile, CampaignOutput } from "campaigns/entity";
import IronVaultPlugin from "index";
import { html, render } from "lit-html";
import {
  App,
  ButtonComponent,
  FileView,
  Setting,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { PlaysetSetting } from "./playset-setting";

export const CAMPAIGN_EDIT_VIEW_TYPE = "iron-vault-campaign-edit";

export class CampaignEditView extends FileView {
  static async openFile(app: App, file: string) {
    // TODO: check that it is a campaign file
    const { workspace } = app;

    const leaves = workspace.getLeavesOfType(CAMPAIGN_EDIT_VIEW_TYPE);
    let leaf: WorkspaceLeaf | undefined = leaves.find(
      (leaf) => leaf.getViewState().state?.file == file,
    );

    if (!leaf) {
      // Our view could not be found in the workspace, create a new leaf
      // in the right sidebar for it
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({
        type: CAMPAIGN_EDIT_VIEW_TYPE,
        active: true,
        state: { file },
      });
    }

    // "Reveal" the leaf in case it is in a collapsed sidebar
    workspace.revealLeaf(leaf);
  }

  constructor(
    leaf: WorkspaceLeaf,
    readonly plugin: IronVaultPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return CAMPAIGN_EDIT_VIEW_TYPE;
  }

  onload(): void {
    this.registerEvent(
      this.plugin.campaigns.on("changed", this.render.bind(this)),
    );
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.render();
  }

  render() {
    if (!this.file || this.file.deleted) {
      render(html`<p>No file!</p>`, this.contentEl);
      return;
    }
    const file = this.file;
    const result = this.plugin.campaigns.get(file.path);
    let campaign: CampaignOutput;
    if (!result) {
      render(
        html`<article class="error">
          File ${file.path} is not a campaign.
        </article>`,
        this.contentEl,
      );
      return;
    } else if (result.isLeft()) {
      try {
        campaign = CampaignFile.permissiveParse(
          this.plugin.app.metadataCache.getCache(file.path),
        );
      } catch (e) {
        render(
          html`<article class="error">
            Campaign at '${file.path}' is invalid:
            <pre>${e}</pre>
          </article>`,
          this.contentEl,
        );
        return;
      }
    } else {
      campaign = result.value.props;
    }

    this.contentEl.empty();
    new Setting(this.contentEl)
      .setName("Display name")
      .setDesc(
        "Sets the campaign display name. (Note: changing this does not cause the campaign folder or index file to be renamed.)",
      )
      .addText((text) =>
        text
          .setValue(campaign.name ?? "")
          .setPlaceholder(campaign.name ?? file.basename)
          .onChange((val) => {
            campaign.name = val ? val : undefined;
          }),
      );

    const playset = campaign.ironvault.playset;

    let playsetKey: string;
    let customConfig: string;
    switch (playset?.type) {
      case "globs":
        playsetKey = "custom";
        customConfig = playset.lines.join("\n");
        break;
      case "registry":
        playsetKey = playset.key;
        customConfig = "";
        break;
      default:
        throw new Error(
          `invalid playset type ${(playset as null | undefined | { type?: string })?.type}`,
        );
    }

    const playsetSetting = new PlaysetSetting(
      this.plugin,
      this.contentEl,
    ).onChange((setting) => {
      saveButton.setDisabled(!setting.isValid());
      const key = setting.playsetKey();
      if (key == "custom") {
        campaign.ironvault.playset = {
          type: "globs",
          lines: setting.customConfig.split(/\r?\n|\r/g),
        };
      } else {
        campaign.ironvault.playset = { type: "registry", key };
      }
    });

    let saveButton!: ButtonComponent;
    new Setting(this.contentEl).addButton((button) =>
      (saveButton = button)
        .setCta()
        .setButtonText("Save")
        .onClick(async () => {
          const newCampaignData = CampaignFile.generate(campaign);
          await this.plugin.app.fileManager.processFrontMatter(
            this.file!,
            (frontmatter) => {
              Object.assign(frontmatter, newCampaignData);
            },
          );
          // TODO(@cwegrzyn): we should handle errors here, and also do something more elegant
          // than this. Maybe navigate to the index file normal markdown edit view?
          this.leaf.detach();
        }),
    );

    playsetSetting.setFromKeyAndConfig(playsetKey, customConfig);
  }

  async onUnloadFile(_file: TFile): Promise<void> {
    this.contentEl.empty();
  }
}
