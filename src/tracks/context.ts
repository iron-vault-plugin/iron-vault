import {
  ActionContext,
  CharacterActionContext,
} from "characters/action-context";
import { App } from "obsidian";
import IronVaultPlugin from "../index";
import { vaultProcess } from "../utils/obsidian";
import { ProgressIndex } from "./indexer";
import { ProgressTrackInfo } from "./progress";
import {
  LegacyTrackWriter,
  ProgressTrackFileWriter,
  ProgressTrackWriterContext,
} from "./writer";

export class ProgressContext {
  private app: App;
  private progressIndex: ProgressIndex;

  constructor(
    plugin: IronVaultPlugin,
    private readonly actionContext: ActionContext,
  ) {
    this.app = plugin.app;
    this.progressIndex = plugin.progressTracks;
  }

  tracks(
    filter: (track: ProgressTrackInfo) => boolean = () => true,
  ): ProgressTrackWriterContext[] {
    const tracks = [];
    for (const [
      trackPath,
      trackAdapter,
    ] of this.progressIndex.ofValid.entries()) {
      tracks.push(
        new ProgressTrackFileWriter(
          trackAdapter,
          vaultProcess(this.app, trackPath),
          trackPath,
        ),
      );
    }

    // TODO: need to refactor this to pull it into actionContext --> but then we need a way
    //       to unify "updatable" tracks with non-updatable tracks
    if (this.actionContext instanceof CharacterActionContext) {
      const [charPath, charContext] = [
        this.actionContext.characterPath,
        this.actionContext.characterContext,
      ];
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
    }

    return tracks.filter(filter);
  }
}
