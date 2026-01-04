/**
 * Live Preview support for inline mechanics using CodeMirror decorations.
 * Inspired by the javalent/dice-roller plugin approach.
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { editorLivePreviewField } from "obsidian";
import IronVaultPlugin from "index";
import {
  isInlineMechanics,
  parseInlineMechanics,
  ParsedInlineMechanics,
} from "./syntax";
import {
  renderInlineMove,
  renderInlineOracle,
  renderInlineProgress,
  renderInlineNoRoll,
  renderInlineTrackAdvance,
  renderInlineTrackCreate,
  renderInlineTrackComplete,
  renderInlineTrackReopen,
  renderInlineClockCreate,
  renderInlineClockAdvance,
  renderInlineClockResolve,
  renderInlineMeter,
  renderInlineBurn,
  renderInlineInitiative,
  renderInlineEntityCreate,
} from "./renderers";

/**
 * Check if the editor selection overlaps with a given range.
 */
function selectionAndRangeOverlap(
  view: EditorView,
  rangeFrom: number,
  rangeTo: number,
): boolean {
  const selection = view.state.selection;
  for (const range of selection.ranges) {
    if (range.from <= rangeTo && range.to >= rangeFrom) {
      return true;
    }
  }
  return false;
}

/**
 * Widget that renders inline mechanics in Live Preview.
 */
class InlineMechanicsWidget extends WidgetType {
  constructor(
    private readonly rawText: string,
    private readonly parsed: ParsedInlineMechanics,
    private readonly plugin: IronVaultPlugin,
  ) {
    super();
  }

  override eq(other: InlineMechanicsWidget): boolean {
    return other.rawText === this.rawText;
  }

  override toDOM(_view: EditorView): HTMLElement {
    switch (this.parsed.type) {
      case "move":
        return renderInlineMove(this.parsed, this.plugin);
      case "oracle":
        return renderInlineOracle(this.parsed, this.plugin);
      case "progress":
        return renderInlineProgress(this.parsed, this.plugin);
      case "no-roll":
        return renderInlineNoRoll(this.parsed, this.plugin);
      case "track-advance":
        return renderInlineTrackAdvance(this.parsed, this.plugin);
      case "track-create":
        return renderInlineTrackCreate(this.parsed, this.plugin);
      case "track-complete":
        return renderInlineTrackComplete(this.parsed, this.plugin);
      case "track-reopen":
        return renderInlineTrackReopen(this.parsed, this.plugin);
      case "clock-create":
        return renderInlineClockCreate(this.parsed, this.plugin);
      case "clock-advance":
        return renderInlineClockAdvance(this.parsed, this.plugin);
      case "clock-resolve":
        return renderInlineClockResolve(this.parsed, this.plugin);
      case "meter":
        return renderInlineMeter(this.parsed, this.plugin);
      case "burn":
        return renderInlineBurn(this.parsed, this.plugin);
      case "initiative":
        return renderInlineInitiative(this.parsed, this.plugin);
      case "entity-create":
        return renderInlineEntityCreate(this.parsed, this.plugin);
    }
  }

  override ignoreEvent(event: MouseEvent | Event): boolean {
    // Allow shift+click to edit the inline code
    if (event.type === "mousedown") {
      if ((event as MouseEvent).shiftKey) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Build decorations for inline mechanics in the visible ranges.
 */
function buildDecorations(
  view: EditorView,
  plugin: IronVaultPlugin,
): DecorationSet {
  const widgets: { from: number; to: number; decoration: Decoration }[] = [];

  // Regex to match inline-code syntax tree nodes
  const inlineCodeRegex = /.*?_?inline-code_?.*/;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (nodeRef) => {
        const type = nodeRef.type;

        // Skip formatting nodes
        if (type.name.includes("formatting")) return;

        // Only process inline code nodes
        if (!inlineCodeRegex.test(type.name)) return;

        const start = nodeRef.from;
        const end = nodeRef.to;

        // Don't replace if cursor is inside the code block
        if (selectionAndRangeOverlap(view, start - 1, end + 1)) return;

        const text = view.state.doc.sliceString(start, end).trim();

        // Skip if not inline mechanics
        if (!isInlineMechanics(text)) return;

        // Parse the inline mechanics
        const parsed = parseInlineMechanics(text);

        if (!parsed) return;

        // Create decoration
        widgets.push({
          from: start - 1,
          to: end + 1,
          decoration: Decoration.replace({
            widget: new InlineMechanicsWidget(text, parsed, plugin),
            inclusive: false,
            block: false,
          }),
        });
      },
    });
  }

  // Sort by position and create decoration set
  widgets.sort((a, b) => a.from - b.from);
  return Decoration.set(
    widgets.map((w) => w.decoration.range(w.from, w.to)),
    true,
  );
}

/**
 * Create the CodeMirror ViewPlugin for inline mechanics.
 */
export function inlineMechanicsPlugin(plugin: IronVaultPlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        // Only activate in Live Preview mode (not source mode)
        try {
          if (!update.state.field(editorLivePreviewField)) {
            this.decorations = Decoration.none;
            return;
          }
        } catch {
          // Field not available
          this.decorations = Decoration.none;
          return;
        }

        // Rebuild decorations when document changes, viewport changes, or selection changes
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        // Check if we're in live preview mode
        try {
          if (!view.state.field(editorLivePreviewField)) {
            return Decoration.none;
          }
        } catch {
          // Field not available, skip
          return Decoration.none;
        }

        return buildDecorations(view, plugin);
      }
    },
    { decorations: (v: { decorations: DecorationSet }) => v.decorations },
  );
}
