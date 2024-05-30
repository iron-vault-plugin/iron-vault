import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlock } from "mechanics/editor";
import {
  createProgressNode,
  createTrackCreationNode,
} from "mechanics/node-builders";
import { App, Editor, MarkdownView, stringifyYaml } from "obsidian";
import { IronVaultPluginSettings } from "settings";
import { getExistingOrNewFolder } from "utils/obsidian";
import { BLOCK_TYPE__TRACK } from "../constants";
import { CustomSuggestModal } from "../utils/suggest";
import { ProgressContext } from "./context";
import { ProgressTrack, ProgressTrackFileAdapter } from "./progress";
import { ProgressTrackCreateModal } from "./progress-create";
import { selectProgressTrack } from "./select";

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

  const progressFolder = await getExistingOrNewFolder(
    plugin.app,
    trackInput.targetFolder,
  );

  // TODO: figure out the templating for this
  const file = await plugin.app.fileManager.createNewFile(
    progressFolder,
    trackInput.fileName,
    "md",
    `---\n${stringifyYaml(track.raw)}\n---\n\n\`\`\`${BLOCK_TYPE__TRACK}\n\`\`\`\n\n`,
  );

  appendNodesToMoveOrMechanicsBlock(
    editor,
    createTrackCreationNode(trackInput.name, file.path),
  );
}
