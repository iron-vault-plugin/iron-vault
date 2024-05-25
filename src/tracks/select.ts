import { App } from "obsidian";
import { CustomSuggestModal } from "../utils/suggest";
import { ProgressContext } from "./context";
import { ProgressTrackInfo } from "./progress";
import { ProgressTrackWriterContext } from "./writer";

export async function selectProgressTrack(
  progressContext: ProgressContext,
  app: App,
  filter: (track: ProgressTrackInfo) => boolean = () => true,
): Promise<ProgressTrackWriterContext> {
  return await CustomSuggestModal.select(
    app,
    progressContext.tracks(filter),
    (trackInfo) => trackInfo.name,
    ({ item: trackInfo }, el) => {
      const track = trackInfo.track;
      el.createEl("small", {
        text: `${trackInfo.trackType}; ${track.boxesFilled}/10 boxes (${track.progress}/40 ticks); ${trackInfo.location}`,
        cls: "iron-vault-suggest-hint",
      });
    },
  );
}
