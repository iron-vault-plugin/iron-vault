import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlock } from "mechanics/editor";
import { createClockNode } from "mechanics/node-builders";
import { App, Editor, MarkdownView } from "obsidian";
import { IronVaultPluginSettings } from "settings";
import { ClockFileAdapter, ClockIndex, clockUpdater } from "../clocks/clock-file";
import { selectClock } from "../clocks/select-clock";
import { vaultProcess } from "../utils/obsidian";
import { CustomSuggestModal } from "../utils/suggest";
import { Clock } from "./clock";
import { ClockCreateModal } from "./clock-create-modal";

export async function advanceClock(
  app: App,
  settings: IronVaultPluginSettings,
  editor: Editor,
  view: MarkdownView,
  clockIndex: ClockIndex,
) {
  // TODO: clearly we should have something like this checking the indexer
  // if (!datastore.ready) {
  //   console.warn("data not ready");
  //   return;
  // }
  const [clockPath, clockInfo] = await selectClock(
    clockIndex,
    app,
    ([, clockInfo]) => clockInfo.clock.active && !clockInfo.clock.isFilled,
  );

  const ticks = await CustomSuggestModal.select(
    app,
    Array(clockInfo.clock.ticksRemaining())
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
    undefined,
    "Select number of segments to fill.",
  );

  const newClock = await clockUpdater(
    vaultProcess(app, clockPath),
    (clockAdapter) => {
      return clockAdapter.updatingClock((clock) => clock.tick(ticks));
    },
  );

  appendNodesToMoveOrMechanicsBlock(
    editor,
    createClockNode(clockPath, clockInfo, newClock.clock),
  );
}

