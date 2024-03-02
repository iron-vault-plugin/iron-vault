import { updating } from "utils/lens";
import { CharacterContext } from "../character-tracker";
import { updater } from "../utils/update";
import {
  ProgressTrack,
  ProgressTrackFileAdapter,
  ProgressTrackInfo,
  ProgressTrackSettings,
} from "./progress";

export interface ProgressTrackWriterContext extends ProgressTrackInfo {
  process(
    updatefn: (track: ProgressTrack) => ProgressTrack,
  ): Promise<ProgressTrackInfo>;
  readonly location: string;
}

export class ProgressTrackFileWriter implements ProgressTrackWriterContext {
  constructor(
    public readonly adapter: ProgressTrackFileAdapter,
    public readonly settings: ProgressTrackSettings,
    public readonly processor: (
      process: (data: any) => object,
    ) => Promise<void>,
    public readonly location: string,
  ) {}
  async process(
    updatefn: (track: ProgressTrack) => ProgressTrack,
  ): Promise<ProgressTrackInfo> {
    return progressTrackUpdater(this.settings)(this.processor, (adapter) => {
      return adapter.updatingTrack(updatefn);
    });
  }

  get name(): string {
    return this.adapter.name;
  }
  get track(): ProgressTrack {
    return this.adapter.track;
  }
  get trackType(): string {
    return this.adapter.trackType;
  }
}

export class LegacyTrackWriter implements ProgressTrackWriterContext {
  constructor(
    public readonly character: CharacterContext,
    public readonly processor: (
      process: (data: any) => object,
    ) => Promise<void>,
    public readonly trackKey: string,
    public readonly location: string,
  ) {}

  async process(
    updatefn: (track: ProgressTrack) => ProgressTrack,
  ): Promise<ProgressTrackInfo> {
    return this.character
      .updater(this.processor, (char, context) =>
        updating(context.lens.special_tracks[this.trackKey], updatefn)(char),
      )
      .then((char) => ({
        track: this.character.lens.special_tracks[this.trackKey].get(char),
        name: this.name,
        trackType: this.trackType,
      }));
  }

  get name(): string {
    return this.character.lens.ruleset.special_tracks[this.trackKey].label;
  }

  get track(): ProgressTrack {
    return this.character.lens.special_tracks[this.trackKey].get(
      this.character.character,
    );
  }

  get trackType(): string {
    return "Legacy";
  }
}

// TODO: feels like this could be merged into some class that provides the same config to
//       ProgressIndexer

export const progressTrackUpdater = (settings: ProgressTrackSettings) =>
  updater<ProgressTrackFileAdapter>(
    (data) =>
      ProgressTrackFileAdapter.create(data, settings).expect("could not parse"),
    (tracker) => tracker.raw,
  );
