import { App } from "obsidian";
import { CustomSuggestModal } from "utils/suggest";
import {
  ProgressIndex,
  ProgressTrackFileAdapter,
  ProgressTrackInfo,
} from "./progress";

export async function selectProgressTrack(
  progressIndex: ProgressIndex,
  app: App,
  filter?: (track: [string, ProgressTrackInfo]) => boolean,
): Promise<[string, ProgressTrackFileAdapter]> {
  let tracks = [...progressIndex.entries()];
  if (filter) {
    tracks = tracks.filter(filter);
  }
  return await CustomSuggestModal.select(
    app,
    tracks,
    ([, trackInfo]) => trackInfo.name,
    ({ item: [path, trackInfo] }, el) => {
      const track = trackInfo.track;
      el.createEl("small", {
        text: `${trackInfo.trackType}; ${track.boxesFilled}/10 boxes (${track.progress}/40 ticks); ${path}`,
        cls: "forged-suggest-hint",
      });
    },
  );
}
