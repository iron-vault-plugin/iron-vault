import { determineCampaignContext } from "campaigns/manager";
import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlock } from "mechanics/editor";
import { createDetailsNode } from "mechanics/node-builders";
import {
  clockResolvedNode,
  createClockCreationNode,
  createClockNode,
} from "mechanics/node-builders/clocks";
import { Editor, MarkdownFileInfo, MarkdownView, Notice } from "obsidian";
import { stripMarkdown } from "utils/strip-markdown";
import { YesNoPrompt } from "utils/ui/yesno";
import { ClockFileAdapter, clockUpdater } from "../clocks/clock-file";
import { selectClock } from "../clocks/select-clock";
import { BLOCK_TYPE__CLOCK, IronVaultKind } from "../constants";
import { createNewIronVaultEntityFile, vaultProcess } from "../utils/obsidian";
import { CustomSuggestModal } from "../utils/suggest";
import { Clock } from "./clock";
import { ClockCreateModal } from "./clock-create-modal";

export async function advanceClock(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView,
) {
  const campaignContext = await determineCampaignContext(plugin, view);
  const [clockPath, clockInfo] = await selectClock(
    campaignContext.clocks,
    plugin,
    ([, clockInfo]) => clockInfo.clock.active && !clockInfo.clock.isFilled,
  );

  const ticks = await CustomSuggestModal.select(
    plugin.app,
    Array(clockInfo.clock.ticksRemaining())
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
    undefined,
    "Select number of segments to fill.",
  );

  let shouldMarkResolved = false;
  if (clockInfo.clock.tick(ticks).isFilled) {
    shouldMarkResolved = await YesNoPrompt.asSuggest(
      plugin.app,
      "This clock is now filled. Do you want to mark it as resolved/inactive?",
    );
  }

  const newClock = await clockUpdater(
    vaultProcess(plugin.app, clockPath),
    (clockAdapter) => {
      return clockAdapter.updatingClock((clock) => {
        let updatedClock = clock.tick(ticks);
        if (shouldMarkResolved) {
          if (updatedClock.isFilled) {
            updatedClock = updatedClock.deactivate();
          } else {
            const msg = `Clock '${clockPath}' was no longer filled and was not marked inactive.`;
            console.warn(msg);
            new Notice(msg, 0);
            shouldMarkResolved = false;
          }
        }
        return updatedClock;
      });
    },
  );

  const clockName = stripMarkdown(plugin, clockInfo.name);
  appendNodesToMoveOrMechanicsBlock(
    editor,
    ...[
      createClockNode(clockName, clockPath, clockInfo, newClock.clock),
      ...(shouldMarkResolved ? [clockResolvedNode(clockName, clockPath)] : []),
    ],
  );
}

export async function resolveClock(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownFileInfo,
) {
  const campaignContext = await determineCampaignContext(plugin, view);
  const [clockPath] = await selectClock(
    campaignContext.clocks,
    plugin,
    ([, clockInfo]) => clockInfo.clock.active,
  );

  const newClock = await clockUpdater(
    vaultProcess(plugin.app, clockPath),
    (clockAdapter) => {
      return clockAdapter.updatingClock((clock) => clock.deactivate());
    },
  );

  appendNodesToMoveOrMechanicsBlock(
    editor,
    clockResolvedNode(stripMarkdown(plugin, newClock.name), clockPath),
  );
}

export async function createClock(
  plugin: IronVaultPlugin,
  editor: Editor,
): Promise<void> {
  const clockInput: {
    targetFolder: string;
    fileName: string;
    name: string;
    clock: Clock;
  } = await new Promise((onAccept, onReject) => {
    new ClockCreateModal(plugin, {}, onAccept, onReject).open();
  });

  const clock =
    ClockFileAdapter.newFromClock(clockInput).expect("invalid clock");

  const file = await createNewIronVaultEntityFile(
    plugin.app,
    clockInput.targetFolder,
    clockInput.fileName,
    IronVaultKind.Clock,
    clock.raw,
    plugin.settings.clockTemplateFile,
    `\n\`\`\`${BLOCK_TYPE__CLOCK}\n\`\`\`\n\n`,
  );

  appendNodesToMoveOrMechanicsBlock(
    editor,
    createClockCreationNode(stripMarkdown(plugin, clockInput.name), file.path),
    ...(plugin.settings.inlineOnCreation
      ? [createDetailsNode(`![[${file.path}|iv-embed]]`)]
      : []),
  );
}
