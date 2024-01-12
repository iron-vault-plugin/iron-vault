import { App } from "obsidian";
import { CustomSuggestModal } from "utils/suggest";
import { ProgressIndex, ProgressTracker } from "./progress";

export async function selectProgressTrack(
  progressIndex: ProgressIndex,
  app: App,
  filter?: (track: [string, ProgressTracker]) => boolean,
): Promise<[string, ProgressTracker]> {
  let tracks = [...progressIndex.entries()];
  if (filter) {
    tracks = tracks.filter(filter);
  }
  return await CustomSuggestModal.select(
    app,
    tracks,
    ([, track]) => track.Name,
    ({ item: [path, track] }, el) => {
      el.createEl("small", {
        text: `${track.tracktype}; ${track.boxesFilled}/10 boxes (${track.Progress}/40 ticks); ${path}`,
        cls: "forged-suggest-hint",
      });
    },
  );
}
