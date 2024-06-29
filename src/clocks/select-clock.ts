import { CustomSuggestModal } from "utils/suggest";

import { ClockFileAdapter, ClockIndex } from "./clock-file";
import IronVaultPlugin from "index";
import { stripMarkdown } from "utils/strip-markdown";

export async function selectClock(
  clockIndex: ClockIndex,
  plugin: IronVaultPlugin,
  filter?: (track: [string, ClockFileAdapter]) => boolean,
): Promise<[string, ClockFileAdapter]> {
  let clocks = [...clockIndex.ofValid.entries()];
  if (filter) {
    clocks = clocks.filter(filter);
  }
  return await CustomSuggestModal.select(
    plugin.app,
    clocks,
    ([, clockInfo]) => stripMarkdown(plugin, clockInfo.name),
    ({ item: [path, clockInfo] }, el) => {
      const clock = clockInfo.clock;
      el.createEl("small", {
        text: `${clock.progress} filled of ${clock.segments} total; ${path}`,
        cls: "iron-vault-suggest-hint",
      });
    },
  );
}
