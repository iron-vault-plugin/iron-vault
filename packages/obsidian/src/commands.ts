import { createNewCampaignCommand } from "campaigns/commands";
import { determineCampaignContext } from "campaigns/manager";
import {
  addAssetToCharacter,
  changeInitiative,
  createNewCharacter,
  pickActiveCharacter,
} from "characters/commands";
import { advanceClock, createClock, resolveClock } from "clocks/commands";
import { openDocsInBrowser, openDocsInTab } from "docs/commands";
import { generateEntityCommand } from "entity/command";
import { createFactionInfluenceGrid } from "factions/commands";
import IronVaultPlugin from "index";
import { insertComment, rollDice } from "mechanics/commands";
import { checkIfMigrationNeededCommand } from "migrate/command";
import { makeActionRollCommand, runMoveCommand } from "moves/action";
import { rerollDie } from "moves/action/action-modal";
import {
  Command,
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Notice,
} from "obsidian";
import { runOracleCommand } from "oracles/command";
import {
  advanceProgressTrack,
  createProgressTrack,
  markTrackCompleted,
} from "tracks/commands";
import { generateTruthsCommand } from "truths/command";
import { CustomSuggestModal } from "utils/suggest";
import {
  GenericFuzzySuggester,
  SuggesterItem,
} from "utils/ui/generic-fuzzy-suggester";
import { PromptModal } from "utils/ui/prompt";
import * as meterCommands from "./characters/meter-commands";

export class IronVaultCommands {
  plugin: IronVaultPlugin;
  commandList: Command[] = [
    {
      id: "show-all-commands",
      name: "Show all commands",
      icon: "iron-vault",
      callback: () => {
        this.showCommandPicker();
      },
    },
    {
      id: "make-a-move",
      name: "Make a move",
      icon: "zap",
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        runMoveCommand(this.plugin, editor, view),
    },
    {
      id: "make-action-roll",
      name: "Make an action roll",
      editorCallback: (editor, view) =>
        makeActionRollCommand(this.plugin, editor, view),
    },
    {
      id: "roll-dice",
      name: "Roll dice",
      icon: "dice",
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        rollDice(this.plugin, editor, view),
    },
    {
      id: "ask-the-oracle",
      name: "Ask the Oracle",
      icon: "message-circle-question",
      editorCallback: (editor, view) =>
        runOracleCommand(this.plugin, editor, view),
    },
    {
      id: "show-sidebar",
      name: "Show sidebar",
      icon: "list",
      callback: () => {
        this.plugin.activateMainSidebarView();
      },
    },
    {
      id: "insert-comment",
      name: "Insert out-of-character (OOC) comment",
      icon: "file-pen-line",
      editorCallback: (editor: Editor) => insertComment(this.plugin, editor),
    },

    /*
     * CHARACTERS
     */
    {
      id: "character-create",
      name: "Create new character",
      icon: "user-round",
      callback: async () =>
        createNewCharacter(
          this.plugin,
          await determineCampaignContext(this.plugin),
        ),
      editorCallback: async (_editor, view) =>
        createNewCharacter(
          this.plugin,
          await determineCampaignContext(this.plugin, view),
        ),
    },
    {
      id: "burn-momentum",
      name: "Burn momentum",
      icon: "flame",
      editorCallback: (editor, view) =>
        meterCommands.burnMomentum(this.plugin, editor, view),
    },
    {
      id: "take-meter",
      name: "Take on a meter",
      icon: "trending-up",
      editorCallback: async (editor, view) =>
        meterCommands.modifyMeterCommand(
          this.plugin,
          editor,
          view,
          "take",
          ({ value, definition: { max } }) =>
            value === undefined || value < max,
          (measure) =>
            Array(measure.definition.max - measure.value)
              .fill(0)
              .map((_, i) => i + 1),
        ),
    },
    {
      id: "suffer-meter",
      name: "Suffer on a meter",
      icon: "trending-down",
      editorCallback: async (editor, view) =>
        meterCommands.modifyMeterCommand(
          this.plugin,
          editor,
          view,
          "suffer",
          ({ value, definition: { min } }) =>
            value === undefined || value > min,
          (measure) =>
            Array(measure.value - measure.definition.min)
              .fill(0)
              .map((_, i) => -1 * (i + 1)),
        ),
    },
    {
      id: "character-add-asset",
      name: "Add asset to character",
      icon: "gem",
      editorCallback: async (
        editor: Editor,
        ctx: MarkdownView | MarkdownFileInfo,
      ) => {
        await addAssetToCharacter(this.plugin, editor, ctx as MarkdownView);
      },
    },
    {
      id: "character-change-initiative",
      name: "Change position or intiative",
      icon: "activity",
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        changeInitiative(this.plugin, editor, view),
    },
    {
      id: "reroll-die",
      name: "Reroll a die",
      icon: "dice",
      editorCallback: (editor: Editor, view) =>
        rerollDie(this.plugin, editor, view),
    },

    /*
     * PROGRESS TRACKS
     */
    {
      id: "progress-create",
      name: "Progress: Create a progress track",
      icon: "square-pen",
      editorCallback: (editor: Editor) =>
        createProgressTrack(this.plugin, editor),
    },
    {
      id: "progress-advance",
      name: "Progress: Advance a progress track",
      icon: "chevrons-right",
      editorCallback: async (
        editor: Editor,
        ctx: MarkdownView | MarkdownFileInfo,
      ) => {
        await advanceProgressTrack(this.plugin, editor, ctx as MarkdownView);
      },
    },
    {
      id: "progress-complete",
      name: "Progress: Complete a progress track",
      icon: "square-check",
      editorCallback: (editor, view) =>
        markTrackCompleted(this.plugin, editor, view),
    },

    /*
     * CLOCKS
     */
    {
      id: "clock-create",
      name: "Clock: Create a clock",
      icon: "alarm-clock",
      editorCallback: (editor: Editor) => createClock(this.plugin, editor),
    },

    {
      id: "clock-advance",
      name: "Clock: Advance a clock",
      icon: "alarm-clock-plus",
      editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) =>
        advanceClock(this.plugin, editor, ctx as MarkdownView),
    },

    {
      id: "clock-resolve",
      name: "Clock: Resolve a clock",
      icon: "alarm-clock-off",
      editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) =>
        resolveClock(this.plugin, editor, ctx),
    },

    /*
     * ENTITIES
     */
    {
      id: "entity-gen",
      name: "Generate an entity",
      icon: "package-plus",
      editorCallback: async (
        editor: Editor,
        ctx: MarkdownView | MarkdownFileInfo,
      ) => {
        await generateEntityCommand(this.plugin, editor, ctx);
      },
    },

    {
      id: "faction-grid-gen",
      name: "Create faction influence grid",
      icon: "table",
      callback: () => createFactionInfluenceGrid(this.plugin),
    },

    /*
     * UTILITY
     */
    {
      id: "pick-active-character",
      name: "Pick active character",
      icon: "user-circle",
      editorCallback: (_editor, view) => pickActiveCharacter(this.plugin, view),
    },
    {
      id: "toggle-mechanics",
      name: "Toggle displaying mechanics",
      icon: "eye-off",
      editorCallback: async (_editor: Editor) => {
        this.plugin.settings.hideMechanics =
          !this.plugin.settings.hideMechanics;
      },
    },
    {
      id: "insert-spoilers",
      name: "Insert spoiler text",
      icon: "lock",
      editorCallback: (editor: Editor) => this.insertSpoilers(editor),
    },

    {
      id: "generate-truths",
      name: "Generate truths",
      icon: "book",
      callback: () => generateTruthsCommand(this.plugin),
      editorCallback: (_editor, view) =>
        generateTruthsCommand(this.plugin, view),
    },
    {
      id: "open-docs-in-tab",
      name: "Open documentation in a tab",
      icon: "book-open",
      callback: () => openDocsInTab(this.plugin),
    },
    {
      id: "open-docs-in-browser",
      name: "Open documentation in your browser",
      icon: "globe",
      callback: () => openDocsInBrowser(),
    },
    {
      id: "migrate-check",
      name: "Check if vault data migration is needed",
      callback: () => checkIfMigrationNeededCommand(this.plugin),
    },
    {
      id: "create-campaign",
      name: "Create a new campaign",
      callback: () => createNewCampaignCommand(this.plugin),
    },
    {
      id: "reload-homebrew",
      name: "Reload homebrew and datasworn data",
      callback: async () => {
        try {
          await this.plugin.datastore.initialize(true);
          // TODO: maybe list the counts of files or something?
          new Notice("Data reloaded successfully.", 5000);
        } catch (e) {
          new Notice(`Failed to reload datasworn data:\n${e}`, 0);
          console.error(e);
        }
      },
    },
    {
      id: "set-action-roll-challenge-dice",
      name: "Set action roll challenge dice sides",
      icon: "dice",
      editorCallback: async (
        _editor: Editor,
        view: MarkdownView | MarkdownFileInfo,
      ) => {
        // This command allows the user to set the number of sides for the challenge dice used in action rolls.
        const campaignContext = await determineCampaignContext(
          this.plugin,
          view,
        );
        if (!campaignContext) {
          new Notice("No active campaign found.", 3000);
          return;
        }

        const [currentSides1, currentSides2] = campaignContext.localSettings
          .actionRollChallengeDiceSides ?? [10, 10];

        const getSortValue = (
          x: number,
          priority1: number,
          priority2: number,
        ) => (x === priority1 ? -2 : x === priority2 ? -1 : x);

        const promptSides = async (currentSides: number, position: string) =>
          await CustomSuggestModal.select(
            this.plugin.app,
            // Sort options so that current sides is first, and d10 is second.
            [8, 10, 12].sort(
              (a, b) =>
                getSortValue(a, currentSides, 10) -
                getSortValue(b, currentSides, 10),
            ),
            (item) =>
              `1d${item}${item === currentSides ? " (current)" : item === 10 ? " (standard)" : ""}`,
            undefined,
            `Select the die to roll for the ${position} challenge dice`,
          );

        const sides1 = await promptSides(currentSides1, "first");
        const sides2 = await promptSides(currentSides2, "second");

        campaignContext.localSettings.actionRollChallengeDiceSides = [
          sides1,
          sides2,
        ];
        await this.plugin.saveSettings();
        new Notice(`Set challenge dice to 1d${sides1} and 1d${sides2}.`, 3000);
      },
    },
  ];

  constructor(plugin: IronVaultPlugin) {
    this.plugin = plugin;
  }

  addCommands() {
    for (const cmd of this.commandList) {
      this.plugin.addCommand(cmd);
    }
  }

  showCommandPicker() {
    const commands: SuggesterItem[] = [];
    const editor = this.plugin.app.workspace.activeEditor?.editor;
    for (const cmd of this.commandList) {
      if (cmd.id === "iron-vault:show-all-commands") continue;
      if (cmd.editorCallback && editor) {
        commands.push({
          display: cmd.name,
          info: cmd.editorCallback.bind(
            null,
            editor,
            this.plugin.app.workspace.getActiveViewOfType(
              MarkdownView,
            ) as MarkdownView,
          ),
        });
      } else if (cmd.callback) {
        commands.push({
          display: cmd.name,
          info: cmd.callback,
        });
      }
    }
    const gfs = new GenericFuzzySuggester(this.plugin);
    gfs.setSuggesterData(commands);
    gfs.display((item) => {
      if (typeof item.info === "function") {
        item.info();
      }
    });
  }

  async insertSpoilers(editor: Editor) {
    const title = await PromptModal.prompt(
      this.plugin.app,
      "Enter spoiler title (this will be visible)",
    );
    const body = await PromptModal.prompt(
      this.plugin.app,
      "Enter spoiler body (this will be hidden)",
    );
    const extraLine = editor.getCursor("from").ch > 0 ? "\n\n" : "";
    editor.replaceSelection(
      `${extraLine}\
> [!spoiler]- ${title}
> ${body}
`,
    );
  }
}
