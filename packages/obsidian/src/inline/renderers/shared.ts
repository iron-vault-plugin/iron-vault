/**
 * Shared utilities for inline mechanics renderers.
 */

import IronVaultPlugin from "index";
import { MoveModal } from "moves/move-modal";
import { SidebarView } from "sidebar/sidebar-view";

/**
 * Create the container element for inline mechanics.
 */
export function createContainer(outcomeClass: string): HTMLSpanElement {
  return createSpan({
    cls: `iv-inline-mechanics ${outcomeClass}`,
  });
}

/**
 * Set tooltip attributes on an element.
 */
export function setTooltip(el: HTMLElement, text: string): void {
  el.setAttribute("aria-label", text);
  el.setAttribute("data-tooltip-position", "top");
}

/**
 * Create a clickable link to a file (track, clock, or entity).
 */
export function createFileLink(
  name: string,
  path: string,
  cssClass: string,
  dataAttr: string,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const linkEl = createSpan({
    cls: `${cssClass} iv-inline-link`,
    text: name,
  });
  linkEl.setAttribute(dataAttr, path);
  linkEl.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    plugin.app.workspace.openLinkText(path, "");
  });
  return linkEl;
}

/**
 * Handle click on a move name - opens modal or sidebar based on settings.
 */
export function handleMoveClick(
  e: MouseEvent,
  plugin: IronVaultPlugin,
  moveId: string,
): void {
  e.stopPropagation();
  e.preventDefault();

  if (plugin.settings.useLegacyMoveModal) {
    const move = plugin.datastore.dataContext.moves.get(moveId);
    if (move) {
      new MoveModal(
        plugin.app,
        plugin,
        plugin.datastore.dataContext,
        move,
      ).open();
    }
  } else {
    SidebarView.activate(plugin.app, moveId);
  }
}

/**
 * Create a clickable move name element.
 */
export function createMoveNameLink(
  name: string,
  moveId: string | undefined,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const nameEl = createSpan({ cls: "iv-inline-move-name", text: name });
  if (moveId) {
    nameEl.addClass("iv-inline-link");
    nameEl.setAttribute("data-move-id", moveId);
    nameEl.addEventListener("click", (e) =>
      handleMoveClick(e as MouseEvent, plugin, moveId),
    );
  }
  return nameEl;
}
