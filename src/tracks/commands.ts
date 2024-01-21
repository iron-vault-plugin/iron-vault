import { App, Editor, MarkdownView } from "obsidian";
import {
  ForgedPluginSettings,
  advanceClockTemplate,
  advanceProgressTemplate,
} from "../settings/ui";
import { vaultProcess } from "../utils/obsidian";
import { CustomSuggestModal } from "../utils/suggest";
import { ClockIndex, clockUpdater } from "./clock-file";
import { ProgressIndex, progressTrackUpdater } from "./progress";
import { selectProgressTrack } from "./select";
import { selectClock } from "./select-clock";

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
    undefined,
    "Select number of times to advance the progress track.",
  );

  const newTrack = await progressTrackUpdater(
    vaultProcess(app, trackPath),
    (trackAdapter) => {
      return trackAdapter.updatingTrack((track) => track.advanced(steps));
    },
  );

  editor.replaceSelection(
    advanceProgressTemplate(settings)({
      trackInfo: newTrack,
      trackPath,
      steps,
    }),
  );
}

export async function advanceClock(
  app: App,
  settings: ForgedPluginSettings,
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

  editor.replaceSelection(
    advanceClockTemplate(settings)({
      clockInfo: newClock,
      clockPath: clockPath,
      ticks,
    }),
  );
}
