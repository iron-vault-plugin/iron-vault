import IronVaultPlugin from "index";
import { PluginSettingTab, Setting, type App } from "obsidian";
import { IronVaultPluginSettings } from "settings";
import { FolderTextSuggest } from "utils/ui/settings/folder";

export class IronVaultSettingTab extends PluginSettingTab {
  plugin: IronVaultPlugin;

  constructor(app: App, plugin: IronVaultPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async updateSetting<K extends keyof IronVaultPluginSettings>(
    key: K,
    value: IronVaultPluginSettings[K],
  ) {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    const { settings } = this.plugin;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Use character system")
      .setDesc(
        "If enabled (default), the plugin will look for an active character when making moves. If disabled, you will be prompted to supply appropriate values when needed.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useCharacterSystem)
          .onChange((value) => this.updateSetting("useCharacterSystem", value)),
      );

    new Setting(containerEl).setName("Rulesets").setHeading();

    new Setting(containerEl)
      .setName("Enable Ironsworn ruleset")
      .setDesc(
        "If enabled, Ironsworn Core oracles, assets, truths, and moves will be available for play.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.enableIronsworn)
          .onChange((value) => this.updateSetting("enableIronsworn", value));
      });

    new Setting(containerEl)
      .setName("Enable Starforged ruleset")
      .setDesc(
        "If enabled, Ironsworn: Starforged oracles, assets, truths, and moves will be available for play.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.enableStarforged)
          .onChange((value) => this.updateSetting("enableStarforged", value));
      });

    new Setting(containerEl).setName("Dice").setHeading();

    new Setting(containerEl)
      .setName("Graphical dice")
      .setDesc("If enabled, dice rolls will use on-screen 3d graphical dice.")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.graphicalDice)
          .onChange((value) => this.updateSetting("graphicalDice", value));
      });

    new Setting(containerEl)
      .setName("Action die color")
      .setDesc("Color used for the action die when using graphical dice.")
      .addColorPicker((color) => {
        color
          .setValue(settings.actionDieColor)
          .onChange((value) => this.updateSetting("actionDieColor", value));
      });

    new Setting(containerEl)
      .setName("Challenge dice color")
      .setDesc("Color used for the challenge dice when using graphical dice.")
      .addColorPicker((color) => {
        color.setValue(settings.challengeDiceColor).onChange((value) => {
          console.log(value);
          this.updateSetting("challengeDiceColor", value);
        });
      });

    new Setting(containerEl)
      .setName("Oracle dice color")
      .setDesc("Color used for the oracle dice when using graphical dice.")
      .addColorPicker((color) => {
        color
          .setValue(settings.oracleDiceColor)
          .onChange((value) => this.updateSetting("oracleDiceColor", value));
      });

    new Setting(containerEl).setName("New game object defaults").setHeading();

    new Setting(containerEl)
      .setName("Default progress track folder")
      .setDesc("Create progress tracks in this folder by default.")
      .addSearch((search) => {
        new FolderTextSuggest(this.app, search.inputEl);
        search
          .setPlaceholder("Type the name of a folder")
          .setValue(settings.defaultProgressTrackFolder)
          .onChange((value) =>
            this.updateSetting("defaultProgressTrackFolder", value),
          );
      });

    new Setting(containerEl)
      .setName("Progress track template file")
      .setDesc(
        "If provided, this file will be appended to new progress track files.",
      )
      .addText((text) => {
        text
          .setPlaceholder("Templates/Progress.md")
          .setValue(settings.progressTrackTemplateFile)
          .onChange((value) => {
            this.updateSetting("progressTrackTemplateFile", value);
          });
      });

    new Setting(containerEl)
      .setName("Default clock folder")
      .setDesc("Create clocks in this folder by default.")
      .addSearch((search) => {
        new FolderTextSuggest(this.app, search.inputEl);
        search
          .setPlaceholder("Type the name of a folder")
          .setValue(settings.defaultClockFolder)
          .onChange((value) => this.updateSetting("defaultClockFolder", value));
      });

    new Setting(containerEl)
      .setName("Clock template file")
      .setDesc("If provided, this file will be appended to new clock files.")
      .addText((text) => {
        text
          .setPlaceholder("Templates/Clock.md")
          .setValue(settings.clockTemplateFile)
          .onChange((value) => {
            this.updateSetting("clockTemplateFile", value);
          });
      });

    new Setting(containerEl)
      .setName("Default characters folder")
      .setDesc("Create player characters in this folder by default.")
      .addSearch((search) => {
        new FolderTextSuggest(this.app, search.inputEl);
        search
          .setPlaceholder("Type the name of a folder")
          .setValue(settings.defaultCharactersFolder)
          .onChange((value) =>
            this.updateSetting("defaultCharactersFolder", value),
          );
      });

    new Setting(containerEl)
      .setName("Character template file")
      .setDesc(
        "If provided, this file will be appended to new Character files.",
      )
      .addText((text) => {
        text
          .setPlaceholder("Templates/Character.md")
          .setValue(settings.characterTemplateFile)
          .onChange((value) => {
            this.updateSetting("characterTemplateFile", value);
          });
      });

    //--- Mechanics blocks

    new Setting(containerEl).setName("Mechanics blocks").setHeading();

    new Setting(containerEl)
      .setName("Collapse move blocks")
      .setDesc(
        "If enabled, moves in mechanics blocks will only show the move name and result by default, and you'll need to click on them to see move details.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.collapseMoves)
          .onChange((value) => this.updateSetting("collapseMoves", value)),
      );

    new Setting(containerEl)
      .setName("Show mechanics toggle")
      .setDesc(
        "If enabled, mechanics blocks will show a small 'Hide mechanics' toggle underneath the mechanics items.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.showMechanicsToggle)
          .onChange((value) =>
            this.updateSetting("showMechanicsToggle", value),
          ),
      );

    new Setting(containerEl)
      .setName("Hide mechanics completely")
      .setDesc(
        "If enabled, mechanics blocks will not be displayed at all. Good for when you want to just read a story.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.hideMechanics)
          .onChange((value) => this.updateSetting("hideMechanics", value)),
      );

    new Setting(containerEl)
      .setName("Inline tracks and clocks on creation")
      .setDesc(
        "If enabled, new tracks and clocks will be automatically inlined in the journal when created.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.inlineOnCreation)
          .onChange((value) => this.updateSetting("inlineOnCreation", value)),
      );

    new Setting(containerEl).setName("Dice rolling").setHeading();

    new Setting(containerEl)
      .setName("Prompt for rolls in Make a Move")
      .setDesc(
        "If enabled, when you Make a Move, the plugin will prompt you to roll your own dice and enter the values.",
      )
      .addToggle((btn) =>
        btn
          .setValue(settings.promptForRollsInMoves)
          .onChange((val) => this.updateSetting("promptForRollsInMoves", val)),
      );

    new Setting(containerEl)
      .setName("Prompt for rolls in Ask the Oracle")
      .setDesc(
        "If enabled, when you Ask the Oracle, the plugin will prompt you to roll your own dice and enter the values.",
      )
      .addToggle((btn) =>
        btn
          .setValue(settings.promptForRollsInOracles)
          .onChange((val) =>
            this.updateSetting("promptForRollsInOracles", val),
          ),
      );
  }
}
