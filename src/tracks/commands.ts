import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlock } from "mechanics/editor";
import { createClockNode, createProgressNode } from "mechanics/node-builders";
import { App, Editor, MarkdownView, stringifyYaml } from "obsidian";
import { IronVaultPluginSettings, createProgressTemplate } from "settings";
import { vaultProcess } from "../utils/obsidian";
import { CustomSuggestModal } from "../utils/suggest";
import { ClockIndex, clockUpdater } from "./clock-file";
import { ProgressContext } from "./context";
import { ProgressTrack, ProgressTrackFileAdapter } from "./progress";
import { ProgressTrackCreateModal } from "./progress-create";
import { selectProgressTrack } from "./select";
import { selectClock } from "./select-clock";

export async function advanceProgressTrack(
  app: App,
  settings: IronVaultPluginSettings,
  editor: Editor,
  view: MarkdownView,
  progressContext: ProgressContext,
) {
  // if (!datastore.ready) {
  //   console.warn("data not ready");
  //   return;
  // }
  const trackContext = await selectProgressTrack(
    progressContext,
    app,
    ({ track }) => !track.complete && track.ticksRemaining > 0,
  );

  const steps = await CustomSuggestModal.select(
    app,
    Array(trackContext.track.stepsRemaining)
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
    undefined,
    "Select number of times to advance the progress track.",
  );

  await trackContext.process((trackAdapter) => trackAdapter.advanced(steps));

  appendNodesToMoveOrMechanicsBlock(
    editor,
    createProgressNode(trackContext, steps),
  );
}

export async function advanceClock(
  app: App,
  settings: IronVaultPluginSettings,
  editor: Editor,
  view: MarkdownView,
  clockIndex: ClockIndex,
) {
  // TODO: clearly we should have something like this checking the indexer
  // if (!datastore.ready) {
  //   console.warn("data not ready");
  //   return;
  // }
  const [clockPath, clockInfo] = await selectClock(
    clockIndex,
    app,
    ([, clockInfo]) => clockInfo.clock.active && !clockInfo.clock.isFilled,
  );

  const ticks = await CustomSuggestModal.select(
    app,
    Array(clockInfo.clock.ticksRemaining())
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
    undefined,
    "Select number of segments to fill.",
  );

  const newClock = await clockUpdater(
    vaultProcess(app, clockPath),
    (clockAdapter) => {
      return clockAdapter.updatingClock((clock) => clock.tick(ticks));
    },
  );

  appendNodesToMoveOrMechanicsBlock(
    editor,
    createClockNode(clockPath, clockInfo, newClock.clock),
  );
}

export async function createProgressTrack(
  plugin: IronVaultPlugin,
  editor: Editor,
): Promise<void> {
  const trackInput: {
    targetFolder: string;
    fileName: string;
    name: string;
    trackType: string;
    track: ProgressTrack;
  } = await new Promise((onAccept, onReject) => {
    new ProgressTrackCreateModal(
      plugin.app,
      { targetFolder: plugin.settings.defaultProgressTrackFolder },
      onAccept,
      onReject,
    ).open();
  });

  const track =
    ProgressTrackFileAdapter.newFromTrack(trackInput).expect("invalid track");

  let progressFolder = plugin.app.vault.getFolderByPath(
    trackInput.targetFolder,
  );
  if (!progressFolder) {
    progressFolder = await plugin.app.vault.createFolder(
      trackInput.targetFolder,
    );
  }

  // TODO: figure out the templating for this
  const file = await plugin.app.fileManager.createNewFile(
    progressFolder,
    trackInput.fileName,
    "md",
    `---\n${stringifyYaml(track.raw)}\n---\n\n# ${track.name}\n\n`,
  );

  editor.replaceSelection(
    createProgressTemplate(plugin.settings)({
      trackInfo: track,
      trackPath: file.path,
    }),
  );
}
