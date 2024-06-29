import IronVaultPlugin from "index";
import { ItemView, Setting, WorkspaceLeaf } from "obsidian";
import { PLUGIN_DATASWORN_VERSION } from "../constants";
import { highlightDiff, writeMigrationLog } from "./command";
import { MigrationManager, MigrationStage } from "./manager";

export const MIGRATION_VIEW_TYPE = "iron-vault-migration-view";

export class IronVaultMigrationView extends ItemView {
  readonly navigation: boolean = false;

  constructor(
    leaf: WorkspaceLeaf,
    readonly plugin: IronVaultPlugin,
  ) {
    super(leaf);
  }

  get manager(): MigrationManager {
    return this.plugin.migrationManager;
  }

  getViewType() {
    return MIGRATION_VIEW_TYPE;
  }

  getDisplayText() {
    return "Iron Vault migration";
  }

  onload(): void {
    super.onload();
    this.registerEvent(this.manager.on("changed", () => this.render()));
  }

  onunload(): void {
    super.onunload();
  }

  async onOpen() {
    if (this.manager.migrationNeeded === undefined) {
      this.manager.scan();
    }
    this.contentEl.addClass("iron-vault-migration-view");
    this.render();
  }

  render() {
    this.contentEl.empty();
    new Setting(this.contentEl).setName("Iron Vault migration").setHeading();

    switch (this.manager.state) {
      case MigrationStage.Scanning:
        this.contentEl.createEl("p", {
          text: "Checking if migration is needed...",
        });
        break;

      case MigrationStage.Scanned:
        if (this.manager.migrationNeeded) {
          new Setting(this.contentEl).setDesc(
            `Your vault uses an old version of Datasworn and needs to be migrated to ${PLUGIN_DATASWORN_VERSION}. You must upgrade before using Iron Vault features.`,
          );

          new Setting(this.contentEl)
            .addButton((btn) =>
              btn
                .setCta()
                .setButtonText("Preview changes")
                .onClick(() => this.manager.generateReport()),
            )
            .addButton((btn) =>
              btn
                .setButtonText("Perform migration")
                .onClick(() => this.manager.performMigration()),
            )
            .addButton((btn) =>
              btn.setButtonText("Not right now").onClick(() => {
                this.leaf.detach();
              }),
            );
        } else {
          this.contentEl.createEl("p", {
            text: `Your vault is up-to-date with Datasworn ${PLUGIN_DATASWORN_VERSION}.`,
          });
        }
        break;

      case MigrationStage.GeneratingReport:
        this.contentEl.createEl("p", {
          text: "Generating migration preview...",
        });
        break;

      case MigrationStage.ReportGenerated: {
        new Setting(this.contentEl)
          .setName("Apply migrations?")
          .setDesc(
            "The following report shows the changes that would be make if you apply migrations. Would you like to continue?",
          )
          .addButton((btn) =>
            btn
              .setButtonText("Perform migration")
              .onClick(() => this.manager.performMigration()),
          )
          .addButton((btn) =>
            btn.setButtonText("Not right now").onClick(() => {
              this.leaf.detach();
            }),
          );

        this.renderMigrationReport();

        break;
      }
      case MigrationStage.Migrating:
        this.contentEl.createEl("p", { text: "Migration in progress..." });
        break;
      case MigrationStage.MigrationComplete:
        new Setting(this.contentEl)
          .setDesc(
            "Migration is completed. The changes made are shown below. You can save the report for future reference.",
          )
          .addButton((btn) =>
            btn
              .setButtonText("Save report")
              .onClick(() =>
                writeMigrationLog(
                  this.plugin.app,
                  this.manager.lastReport!,
                  "actual",
                ),
              ),
          )
          .addButton((btn) =>
            btn.setButtonText("Close tab").onClick(() => {
              this.leaf.detach();
            }),
          );
        this.renderMigrationReport();
    }
  }

  async onClose() {
    // Nothing to clean up.
  }

  protected renderMigrationReport() {
    const reportEl = this.contentEl.createDiv({
      cls: ["iron-vault-migration-report"],
    });
    for (const { path, changes } of this.manager.lastReport!) {
      reportEl.createEl("h4", { text: path });

      const listEl = reportEl.createEl("dl");
      for (const change of changes) {
        listEl.createEl("dt", { text: `Line ${change.line}` });
        listEl.createEl("dd").appendChild(highlightDiff(change));
      }
    }
  }
}
