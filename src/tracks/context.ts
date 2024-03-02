import { App } from "obsidian";
import { CharacterTracker } from "../character-tracker";
import ForgedPlugin from "../index";
import { vaultProcess } from "../utils/obsidian";
import {
  ProgressIndex,
  ProgressTrackInfo,
  ProgressTrackSettings,
} from "./progress";
import {
  LegacyTrackWriter,
  ProgressTrackFileWriter,
  ProgressTrackWriterContext,
} from "./writer";

export class ProgressContext {
  private app: App;
  private progressIndex: ProgressIndex;
  private progressSettings: ProgressTrackSettings;
  private characterTracker: CharacterTracker;

  constructor(plugin: ForgedPlugin) {
    this.app = plugin.app;
    this.progressIndex = plugin.progressIndex;
    this.progressSettings = plugin.progressTrackSettings;
    this.characterTracker = plugin.characters;
  }

  tracks(
    filter: (track: ProgressTrackInfo) => boolean = () => true,
  ): ProgressTrackWriterContext[] {
    const tracks = [];
    for (const [trackPath, trackAdapter] of this.progressIndex.entries()) {
      tracks.push(
        new ProgressTrackFileWriter(
          trackAdapter,
          this.progressSettings,
          vaultProcess(this.app, trackPath),
          trackPath,
        ),
      );
    }

    const [charPath, charContext] = this.characterTracker.activeCharacter();
    for (const trackKey in charContext.lens.special_tracks) {
      tracks.push(
        new LegacyTrackWriter(
          charContext,
          vaultProcess(this.app, charPath),
          trackKey,
          charPath,
        ),
      );
    }

    return tracks.filter(filter);
  }
}
