import { stripMarkdown } from "utils/strip-markdown";
import { CustomSuggestModal } from "../utils/suggest";
import { ProgressContext } from "./context";
import { ProgressTrackInfo } from "./progress";
import { ProgressTrackWriterContext } from "./writer";
import IronVaultPlugin from "index";

export async function selectProgressTrack(
  progressContext: ProgressContext,
  plugin: IronVaultPlugin,
  filter: (track: ProgressTrackInfo) => boolean = () => true,
): Promise<ProgressTrackWriterContext> {
  return await CustomSuggestModal.select(
    plugin.app,
    progressContext.tracks(filter),
    (trackInfo) => stripMarkdown(plugin, trackInfo.name),
    ({ item: trackInfo }, el) => {
      const track = trackInfo.track;
      el.createEl("small", {
        text: `${trackInfo.trackType}; ${track.boxesFilled}/10 boxes (${track.progress}/40 ticks); ${trackInfo.location}`,
        cls: "iron-vault-suggest-hint",
      });
    },
  );
}
