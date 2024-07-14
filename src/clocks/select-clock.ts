import { CustomSuggestModal } from "utils/suggest";

import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import { stripMarkdown } from "utils/strip-markdown";
import { ClockFileAdapter, ClockIndex } from "./clock-file";

export async function selectClock(
  clockIndex: ClockIndex,
  plugin: IronVaultPlugin,
  filter?: (track: [string, ClockFileAdapter]) => boolean,
): Promise<[string, ClockFileAdapter]> {
  let clocks = [...onlyValid(clockIndex).entries()];
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
