import IronVaultPlugin from "index";
import { runMoveCommand } from "moves/action";
import { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";
import * as meterCommands from "./characters/meter-commands";
import { runOracleCommand } from "oracles/command";
import { advanceProgressTrack, createProgressTrack } from "tracks/commands";
import { determineCharacterActionContext } from "characters/action-context";
import { ProgressContext } from "tracks/context";
import { advanceClock, createClock } from "clocks/commands";
import { generateEntityCommand } from "entity/command";
import { addAssetToCharacter, createNewCharacter } from "characters/commands";
import {
  GenericFuzzySuggester,
  SuggesterItem,
} from "utils/ui/generic-fuzzy-suggester";

export class IronVaultCommands {
  plugin: IronVaultPlugin;
  commandList = [
    {
      id: "show-all-commands",
      name: "Show all commands",
      icon: "list",
      callback: () => {
        this.showCommandPicker();
      },
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
      id: "make-a-move",
      name: "Make a move",
      icon: "zap",
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        // TODO: what if view is just a fileinfo?
        runMoveCommand(this.plugin, editor, view as MarkdownView),
    },
    {
      id: "ask-the-oracle",
      name: "Ask the Oracle",
      icon: "message-circle-question",
      editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) =>
        runOracleCommand(this.plugin, editor, view as MarkdownView),
    },
    {
      id: "burn-momentum",
      name: "Burn momentum",
      icon: "flame",
      editorCallback: (editor: Editor) =>
        meterCommands.burnMomentum(this.plugin, editor),
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
        const actionContext = await determineCharacterActionContext(
          this.plugin,
        );
        if (!actionContext) return;
        await advanceProgressTrack(
          this.plugin.app,
          this.plugin.settings,
          editor,
          ctx as MarkdownView,
          new ProgressContext(this.plugin, actionContext),
        );
      },
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
        advanceClock(
          this.plugin.app,
          this.plugin.settings,
          editor,
          ctx as MarkdownView,
          this.plugin.clockIndex,
        ),
    },
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
      id: "take-meter",
      name: "Take on a meter",
      icon: "trending-up",
      editorCallback: async (editor: Editor) =>
        meterCommands.modifyMeterCommand(
          this.plugin,
          editor,
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
      editorCallback: async (editor: Editor) =>
        meterCommands.modifyMeterCommand(
          this.plugin,
          editor,
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
      id: "toggle-mechanics",
      name: "Toggle displaying mechanics",
      icon: "eye-off",
      editorCallback: async (_editor: Editor) => {
        this.plugin.settings.hideMechanics =
          !this.plugin.settings.hideMechanics;
      },
    },
    {
      id: "character-create",
      name: "Create new character",
      callback: () => createNewCharacter(this.plugin),
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
}
