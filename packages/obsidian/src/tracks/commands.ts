import { determineCharacterActionContext } from "characters/action-context";
import IronVaultPlugin from "index";
import { appendNodesToMoveOrMechanicsBlock } from "mechanics/editor";
import {
  createDetailsNode,
  createProgressNode,
  createTrackCompletionNode,
  createTrackCreationNode,
  createTrackIncompletionNode,
} from "mechanics/node-builders";
import { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";
import { createNewIronVaultEntityFile } from "utils/obsidian";
import { stripMarkdown } from "utils/strip-markdown";
import { BLOCK_TYPE__TRACK, IronVaultKind } from "../constants";
import { CustomSuggestModal } from "../utils/suggest";
import { ProgressContext } from "./context";
import { ProgressTrackFileAdapter } from "./progress";
import { ProgressTrackCreateModal } from "./progress-create";
import { selectProgressTrack } from "./select";
import {
  trackAdvanceToInlineSyntax,
  trackCreateToInlineSyntax,
  trackCompleteToInlineSyntax,
  trackReopenToInlineSyntax,
  insertInlineText,
} from "../inline";

export async function advanceProgressTrack(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView,
) {
  const actionContext = await determineCharacterActionContext(plugin, view);

  const progressContext = new ProgressContext(plugin, actionContext);

  const trackContext = await selectProgressTrack(
    progressContext,
    plugin,
    ({ track }) => !track.complete && track.ticksRemaining > 0,
  );

  const steps = await CustomSuggestModal.select(
    plugin.app,
    Array(trackContext.track.stepsRemaining)
      .fill(0)
      .map((_, i) => i + 1),
    (num) => num.toString(),
    undefined,
    "Select number of times to advance the progress track.",
  );

  const fromProgress = trackContext.track.progress;
  const updatedTrack = await trackContext.process((trackAdapter) => trackAdapter.advanced(steps));

  // Use inline if setting is enabled
  if (plugin.settings.useInlineProgressTracks) {
    const inlineText = trackAdvanceToInlineSyntax(
      stripMarkdown(plugin, trackContext.name),
      trackContext.location,
      fromProgress,
      updatedTrack.track.progress,
      updatedTrack.track.rank,
      steps,
    );
    insertInlineText(editor, inlineText);
  } else {
    appendNodesToMoveOrMechanicsBlock(
      editor,
      createProgressNode(
        stripMarkdown(plugin, trackContext.name),
        trackContext,
        steps,
      ),
    );
  }
}

export async function createProgressTrack(
  plugin: IronVaultPlugin,
  editor: Editor,
): Promise<void> {
  const trackInput = await ProgressTrackCreateModal.show(plugin);

  const track = ProgressTrackFileAdapter.newFromTrack(trackInput);

  const file = await createNewIronVaultEntityFile(
    plugin.app,
    trackInput.targetFolder,
    trackInput.fileName,
    IronVaultKind.ProgressTrack,
    {
      ...track.raw,
      "track-type": trackInput.trackType,
    },
    plugin.settings.progressTrackTemplateFile,
    `\n\`\`\`${BLOCK_TYPE__TRACK}\n\`\`\`\n\n`,
  );

  // Use inline if setting is enabled
  if (plugin.settings.useInlineProgressTracks) {
    const inlineText = trackCreateToInlineSyntax(
      stripMarkdown(plugin, trackInput.name),
      file.path,
    );
    insertInlineText(editor, inlineText);
    // Still add the embed if that setting is enabled
    if (plugin.settings.inlineOnCreation) {
      editor.replaceSelection(`![[${file.path}|iv-embed]] `);
    }
  } else {
    appendNodesToMoveOrMechanicsBlock(
      editor,
      createTrackCreationNode(stripMarkdown(plugin, trackInput.name), file.path),
      ...(plugin.settings.inlineOnCreation
        ? [createDetailsNode(`![[${file.path}|iv-embed]]`)]
        : []),
    );
  }
}

export async function markTrackCompleted(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
): Promise<void> {
  const actionContext = await determineCharacterActionContext(plugin, view);
  const progressContext = new ProgressContext(plugin, actionContext);
  const trackContext = await selectProgressTrack(
    progressContext,
    plugin,
    ({ trackType, track }) => trackType !== "Legacy" && !track.complete,
  );

  await trackContext.process((trackAdapter) => trackAdapter.completed());

  // Use inline if setting is enabled
  if (plugin.settings.useInlineProgressTracks) {
    const inlineText = trackCompleteToInlineSyntax(
      stripMarkdown(plugin, trackContext.name),
      trackContext.location,
    );
    insertInlineText(editor, inlineText);
  } else {
    appendNodesToMoveOrMechanicsBlock(
      editor,
      createTrackCompletionNode(
        stripMarkdown(plugin, trackContext.name),
        trackContext.location,
      ),
    );
  }
}

export async function markTrackIncomplete(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
): Promise<void> {
  const actionContext = await determineCharacterActionContext(plugin, view);
  const progressContext = new ProgressContext(plugin, actionContext);
  const trackContext = await selectProgressTrack(
    progressContext,
    plugin,
    ({ trackType, track }) => trackType !== "Legacy" && track.complete,
  );

  await trackContext.process((trackAdapter) => trackAdapter.markIncomplete());

  // Use inline if setting is enabled
  if (plugin.settings.useInlineProgressTracks) {
    const inlineText = trackReopenToInlineSyntax(
      stripMarkdown(plugin, trackContext.name),
      trackContext.location,
    );
    insertInlineText(editor, inlineText);
  } else {
    appendNodesToMoveOrMechanicsBlock(
      editor,
      createTrackIncompletionNode(
        stripMarkdown(plugin, trackContext.name),
        trackContext.location,
      ),
    );
  }
}
