import IronVaultPlugin from "index";
import { PluginSettingTab, Setting, type App } from "obsidian";
import { IronVaultPluginSettings } from "settings";
import { FolderTextSuggest } from "utils/ui/settings/folder";

export class IronVaultSettingTab extends PluginSettingTab {
  override plugin: IronVaultPlugin;

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

    new Setting(containerEl)
      .setName("Always prompt for active character")
      .setDesc(
        "If enabled, the plugin will always prompt when taking an action where an active character is required, if there are multiple characters in the campaign. Otherwise, it will remember the last used active character. You can also change the active character with the 'Pick active character' command.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.alwaysPromptActiveCharacter)
          .onChange((value) =>
            this.updateSetting("alwaysPromptActiveCharacter", value),
          ),
      );

    new Setting(containerEl)
      .setName("Reset to defaults")
      .setDesc("Set all Iron Vault settings back to their default values.")
      .addButton((button) => {
        button.setButtonText("Reset").onClick(async () => {
          this.plugin.settings.reset();
          this.display();
        });
      });

    new Setting(containerEl).setName("Homebrew").setHeading();

    new Setting(containerEl)
      .setName("Enable Homebrew content")
      .setDesc(
        "If enabled, Homebrew content from the folder below will be avilable for play.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.useHomebrew)
          .onChange((value) => this.updateSetting("useHomebrew", value));
      });

    new Setting(containerEl)
      .setName("Homebrew content folder")
      .setDesc("Load custom rulesets from this folder.")
      .addSearch((search) => {
        new FolderTextSuggest(this.app, search.inputEl);

        let isValidPath = true;

        search.inputEl.addEventListener("blur", () => {
          if (!isValidPath) {
            search.inputEl.addClass("iv-invalid-setting");
          } else {
            search.inputEl.removeClass("iv-invalid-setting");
          }
        });

        search
          .setPlaceholder("Type the name of a folder")
          .setValue(settings.homebrewPath)
          .onChange((value) => {
            const homebrewFolder = this.plugin.app.vault.getFolderByPath(value);
            if (homebrewFolder === null) {
              isValidPath = false;
              return;
            }
            isValidPath = true;
            this.updateSetting("homebrewPath", value);
          });
      });

    new Setting(containerEl).setName("Dice").setHeading();

    new Setting(containerEl)
      .setName("Use legacy oracle roller dialog")
      .setDesc(
        "If enabled, reverts to the legacy Ask the Oracle result dialog.",
      )
      .addToggle((btn) =>
        btn
          .setValue(settings.useLegacyRoller)
          .onChange((val) => this.updateSetting("useLegacyRoller", val)),
      );

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

    new Setting(containerEl)
      .setName("Cursed die kind")
      .setDesc("Type of die to use for the cursed die.")
      .addDropdown((dropdown) => {
        dropdown
          .addOptions({
            "4": "d4",
            "6": "d6",
            "8": "d8",
            "10": "d10",
            "12": "d12",
            "20": "d20",
            "100": "d100",
          })
          .setValue("" + settings.cursedDieSides)
          .onChange((value) => this.updateSetting("cursedDieSides", +value));
      });

    new Setting(containerEl)
      .setName("Enable cursed die")
      .setDesc(
        "If enabled, the cursed die will be rolled together with your oracle roll for any tables that have cursed variants.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.enableCursedDie)
          .onChange((value) => this.updateSetting("enableCursedDie", value)),
      );

    new Setting(containerEl)
      .setName("Graphical oracle dice")
      .setDesc(
        "If enabled, dice rolls will use on-screen 3d graphical dice when making oracle rolls.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.graphicalOracleDice)
          .onChange((value) =>
            this.updateSetting("graphicalOracleDice", value),
          );
      });

    new Setting(containerEl)
      .setName("Graphical action dice")
      .setDesc(
        "If enabled, dice rolls will use on-screen 3d graphical dice when making action and progress rolls.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.graphicalActionDice)
          .onChange((value) =>
            this.updateSetting("graphicalActionDice", value),
          );
      });

    new Setting(containerEl)
      .setName("Show dice debugger")
      .setDesc(
        "If enabled, graphical dice will show a debug view explaining how the rolls were calculated.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.diceRollerDebug)
          .onChange((value) => this.updateSetting("diceRollerDebug", value));
      });

    new Setting(containerEl)
      .setName("Hide dice delay")
      .setDesc(
        "How long to wait before hiding the dice overlay. Set to 0 to disable.",
      )
      .addSlider((slider) => {
        slider
          .setLimits(0, 30, 1)
          .setDynamicTooltip()
          .setValue(settings.diceHideAfterSecs)
          .onChange((value) => {
            this.updateSetting("diceHideAfterSecs", value);
          });
      });

    new Setting(containerEl)
      .setName("Allow dice clickthrough")
      .setDesc(
        "If enabled, the dice overlay will not block clicks after the roll is complete. This allows you to interact with, e.g., the dice roller modal without an extra click.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.diceAllowClickthrough)
          .onChange((value) =>
            this.updateSetting("diceAllowClickthrough", value),
          );
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
      .setName("Challenge die 1 color")
      .setDesc(
        "Color used for the first challenge die when using graphical dice. You can configure them separately to implement Twin Fates.",
      )
      .addColorPicker((color) => {
        color.setValue(settings.challengeDie1Color).onChange((value) => {
          this.updateSetting("challengeDie1Color", value);
        });
      });

    new Setting(containerEl)
      .setName("Challenge die 2 color")
      .setDesc(
        "Color used for the second challenge die when using graphical dice. You can configure them separately to implement Twin Fates.",
      )
      .addColorPicker((color) => {
        color.setValue(settings.challengeDie2Color).onChange((value) => {
          this.updateSetting("challengeDie2Color", value);
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

    new Setting(containerEl)
      .setName("Cursed die color")
      .setDesc("Color used for the cursed die when using graphical dice.")
      .addColorPicker((color) => {
        color
          .setValue(settings.cursedDieColor)
          .onChange((value) => this.updateSetting("cursedDieColor", value));
      });

    new Setting(containerEl).setName("New game object defaults").setHeading();

    new Setting(containerEl)
      .setName("Default progress track folder")
      .setDesc(
        "Default path within a campaign folder to use for new progress tracks. If provided, this folder will be created when you first create a campaign.",
      )
      .addText((text) => {
        text
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
      .setDesc(
        "Default path within a campaign folder to use for new clocks. If provided, this folder will be created when you first create a campaign.",
      )
      .addText((text) => {
        text
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
      .setDesc(
        "Default path within a campaign folder to use for new campaigns. If provided, this folder will be created when you first create a campaign.",
      )
      .addText((text) => {
        text
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

    //--- Display

    new Setting(containerEl).setName("Display").setHeading();

    new Setting(containerEl)
      .setName("Hide mechanics completely")
      .setDesc(
        "If enabled, mechanics blocks and inline mechanics will not be displayed at all. Good for when you want to just read a story.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.hideMechanics)
          .onChange((value) => this.updateSetting("hideMechanics", value)),
      );

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
      .setName("Always record actor")
      .setDesc(
        "Enable this to generate actor blocks, even in a campaign with only one PC.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.alwaysRecordActor)
          .onChange((value) => this.updateSetting("alwaysRecordActor", value)),
      );

    new Setting(containerEl)
      .setName("Embed tracks and clocks on creation")
      .setDesc(
        "If enabled, new tracks and clocks will have an embed link added to the mechanics block when created.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.inlineOnCreation)
          .onChange((value) => this.updateSetting("inlineOnCreation", value)),
      );

    //--- Inline mechanics

    new Setting(containerEl).setName("Inline mechanics").setHeading();

    new Setting(containerEl)
      .setName("Use inline moves")
      .setDesc(
        "When enabled, move results are inserted as inline text instead of code blocks.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useInlineMoves)
          .onChange((value) => this.updateSetting("useInlineMoves", value)),
      );

    new Setting(containerEl)
      .setName("Use inline oracles")
      .setDesc(
        "When enabled, oracle results are inserted as inline text instead of code blocks.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useInlineOracles)
          .onChange((value) => this.updateSetting("useInlineOracles", value)),
      );

    new Setting(containerEl)
      .setName("Use inline progress tracks")
      .setDesc(
        "When enabled, progress track operations (create, advance, complete, reopen) are inserted as inline text instead of code blocks..",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useInlineProgressTracks)
          .onChange((value) =>
            this.updateSetting("useInlineProgressTracks", value),
          ),
      );

    new Setting(containerEl)
      .setName("Use inline clocks")
      .setDesc(
        "When enabled, clock operations (create, advance, resolve) are inserted as inline text instead of code blocks..",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useInlineClocks)
          .onChange((value) => this.updateSetting("useInlineClocks", value)),
      );

    new Setting(containerEl)
      .setName("Use inline meters")
      .setDesc(
        "When enabled, character meter changes (health, momentum, burn, initiative) are inserted as inline text instead of code blocks..",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useInlineMeters)
          .onChange((value) => this.updateSetting("useInlineMeters", value)),
      );

    new Setting(containerEl)
      .setName("Use inline entities")
      .setDesc(
        "When enabled, entity generations (NPCs, locations, etc.) are inserted as inline text when a file is created. Oracle rolls are still stored in the entity file.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useInlineEntities)
          .onChange((value) => this.updateSetting("useInlineEntities", value)),
      );

    new Setting(containerEl)
      .setName("Use inline dice rolls")
      .setDesc(
        "When enabled, dice rolls (Roll dice, Make action roll) are inserted as inline text instead of code blocks.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useInlineDiceRolls)
          .onChange((value) => this.updateSetting("useInlineDiceRolls", value)),
      );

    new Setting(containerEl).setName("Legacy").setHeading();

    new Setting(containerEl)
      .setName("Disable embedding moves in sidebar")
      .setDesc(
        "If enabled, revert to old Iron Vault behavior of including only the name and trigger text in the sidebar. Clicking on move links will open in a move modal instead of sidebar.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useLegacyMoveModal)
          .onChange((value) => this.updateSetting("useLegacyMoveModal", value)),
      );
  }
}
