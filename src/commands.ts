import { createNewCampaignCommand } from "campaigns/commands";
import {
  addAssetToCharacter,
  changeInitiative,
  createNewCharacter,
  pickActiveCharacter,
} from "characters/commands";
import { advanceClock, createClock } from "clocks/commands";
import { openDocsInBrowser, openDocsInTab } from "docs/commands";
import { generateEntityCommand } from "entity/command";
import IronVaultPlugin from "index";
import { insertComment } from "mechanics/commands";
import { checkIfMigrationNeededCommand } from "migrate/command";
import { makeActionRollCommand, runMoveCommand } from "moves/action";
import { rerollDie } from "moves/action/action-modal";
import { Command, Editor, MarkdownFileInfo, MarkdownView } from "obsidian";
import { runOracleCommand } from "oracles/command";
import {
  advanceProgressTrack,
  createProgressTrack,
  markTrackCompleted,
} from "tracks/commands";
import { generateTruthsCommand } from "truths/command";
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
        this.plugin.activateView();
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
      callback: () => createNewCharacter(this.plugin),
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

    /*
     * UTILITY
     */
    {
      id: "pick-active-character",
      name: "Pick active character",
      icon: "user-circle",
      editorCallback: (editor, view) => pickActiveCharacter(this.plugin, view),
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
