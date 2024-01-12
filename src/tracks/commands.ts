import { App, Editor, MarkdownView } from "obsidian";
import { ForgedPluginSettings } from "settings/ui";
import { CustomSuggestModal } from "utils/suggest";
import { updater, vaultProcess } from "utils/update";
import { ProgressIndex, ProgressTracker } from "./progress";
import { selectProgressTrack } from "./select";

import Handlebars from "handlebars";

const progressTrackUpdater = updater(
  (data) => ProgressTracker.fromDataWithRepair(data),
  (tracker) => tracker,
);

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
  const [trackPath, track] = await selectProgressTrack(
    progressIndex,
    app,
    ([, track]) => track.incomplete && track.ticksRemaining > 0,
  );

  const steps = await CustomSuggestModal.select(
    app,
    Array(track.stepsRemaining)
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
  );

  const newTrack = await progressTrackUpdater(
    vaultProcess(app, trackPath),
    (track) => {
      return track.advanced(steps);
    },
  );

  // TODO: centralize the template compilation, so we can include type information for the template delegates
  const template = Handlebars.compile(settings.advanceProgressTemplate, {
    noEscape: true,
  });
  editor.replaceSelection(
    template(
      {
        track: newTrack,
        trackPath,
        oldTrack: track,
        steps,
      },
      { allowProtoPropertiesByDefault: true },
    ),
  );
}
