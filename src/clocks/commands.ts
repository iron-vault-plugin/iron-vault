import { determineCampaignContext } from "campaigns/manager";
import IronVaultPlugin from "index";
import { Node } from "kdljs";
import { appendNodesToMoveOrMechanicsBlock } from "mechanics/editor";
import { createDetailsNode } from "mechanics/node-builders";
import {
  clockResolvedNode,
  createClockCreationNode,
  createClockNode,
} from "mechanics/node-builders/clocks";
import { Editor, MarkdownFileInfo, MarkdownView, Notice } from "obsidian";
import { Dice, DieKind } from "utils/dice";
import { DiceGroup } from "utils/dice-group";
import { node } from "utils/kdl";
import { capitalize } from "utils/strings";
import { stripMarkdown } from "utils/strip-markdown";
import { YesNoPrompt } from "utils/ui/yesno";
import {
  ClockFileAdapter,
  clockUpdater,
  namedOddsSchema,
  STANDARD_ODDS,
} from "../clocks/clock-file";
import { selectClock } from "../clocks/select-clock";
import { BLOCK_TYPE__CLOCK, IronVaultKind } from "../constants";
import { createNewIronVaultEntityFile, vaultProcess } from "../utils/obsidian";
import { CustomSuggestModal } from "../utils/suggest";
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

  const defaultOdds = clockInfo.raw.defaultOdds;
  let wrapClockUpdates: (nodes: Node[]) => Node[];
  if (defaultOdds !== "no roll") {
    const oddsIndex = namedOddsSchema.options.findIndex(
      (val) => defaultOdds === val,
    );
    const roll = await CustomSuggestModal.select(
      plugin.app,
      namedOddsSchema.options,
      (odds) => `${capitalize(odds)} (${STANDARD_ODDS[odds]}%)`,
      undefined,
      "Choose the odds to advance",
      oddsIndex > -1 ? oddsIndex : undefined,
    );
    const rollOdds = STANDARD_ODDS[roll];
    const result = await campaignContext
      .diceRollerFor("move")
      .rollAsync(DiceGroup.of(Dice.fromDiceString("1d100", DieKind.Oracle)));
    const shouldAdvance = result[0].value <= rollOdds;

    wrapClockUpdates = (nodes) => {
      const props: { name: string; roll: number; result: string } = {
        name: `Will [[${clockPath}|${stripMarkdown(plugin, clockInfo.name)}]] advance? (${capitalize(roll)})`,
        roll: result[0].value,
        result: shouldAdvance ? "Yes" : "No",
      };
      return [
        node("oracle", {
          properties: props,
          children: nodes,
        }),
      ];
    };

    if (!shouldAdvance) {
      appendNodesToMoveOrMechanicsBlock(editor, ...wrapClockUpdates([]));
      return;
    }
  } else {
    wrapClockUpdates = (nodes) => nodes;
  }

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
    ...wrapClockUpdates([
      createClockNode(clockName, clockPath, clockInfo, newClock.clock),
      ...(shouldMarkResolved ? [clockResolvedNode(clockName, clockPath)] : []),
    ]),
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
  const clockInput = await ClockCreateModal.show(plugin);

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
