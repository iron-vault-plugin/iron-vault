import { App } from "obsidian";
import { CustomSuggestModal } from "utils/suggest";

import { ClockFileAdapter, ClockIndex } from "./clock-file";

export async function selectClock(
  clockIndex: ClockIndex,
  app: App,
  filter?: (track: [string, ClockFileAdapter]) => boolean,
): Promise<[string, ClockFileAdapter]> {
  let clocks = [...clockIndex.entries()];
  if (filter) {
    clocks = clocks.filter(filter);
  }
  return await CustomSuggestModal.select(
    app,
    clocks,
    ([, clockInfo]) => clockInfo.name,
    ({ item: [path, clockInfo] }, el) => {
      const clock = clockInfo.clock;
      el.createEl("small", {
        text: `${clock.progress} filled of ${clock.segments} total; ${path}`,
        cls: "iron-vault-suggest-hint",
      });
    },
  );
}
