import { App, Editor, MarkdownView } from "obsidian";
import { ForgedPluginSettings, advanceProgressTemplate } from "../settings/ui";
import { vaultProcess } from "../utils/obsidian";
import { CustomSuggestModal } from "../utils/suggest";
import { ProgressIndex, progressTrackUpdater } from "./progress";
import { selectProgressTrack } from "./select";

export async function advanceProgressTrack(
  app: App,
  settings: ForgedPluginSettings,
  editor: Editor,
  view: MarkdownView,
  progressIndex: ProgressIndex,
) {
  // if (!datastore.ready) {
  //   console.warn("data not ready");
  //   return;
  // }
  const [trackPath, trackInfo] = await selectProgressTrack(
    progressIndex,
    app,
    ([, trackInfo]) =>
      !trackInfo.track.complete && trackInfo.track.ticksRemaining > 0,
  );

  const steps = await CustomSuggestModal.select(
    app,
    Array(trackInfo.track.stepsRemaining)
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
  );

  const newTrack = await progressTrackUpdater(
    vaultProcess(app, trackPath),
    (trackAdapter) => {
      return trackAdapter.updatingTrack((track) => track.advanced(steps));
    },
  );

  editor.replaceSelection(
    advanceProgressTemplate(settings)(
      {
        trackInfo: newTrack,
        trackPath,
        steps,
      },
      { allowProtoPropertiesByDefault: true },
    ),
  );
}
