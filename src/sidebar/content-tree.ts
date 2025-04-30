import { HTMLTemplateResult, TemplateResult, html, nothing } from "lit-html";
import { styleMap } from "lit-html/directives/style-map.js";
import { SearchComponent, setIcon, setTooltip } from "obsidian";

export function renderGrouping({
  open,
  listItemClass,
  children,
  color,
  name,
  onToggle,
  hidden,
}: {
  open?: boolean;
  listItemClass?: string;
  children: HTMLTemplateResult | HTMLTemplateResult[];
  color?: string;
  name: string;
  onToggle?: (ev: ToggleEvent) => void;
  hidden?: boolean;
}) {
  return html`<li
    class="${listItemClass || nothing}"
    style=${styleMap({
      color: color && `border-left: 6px solid ${color}`,
      display: hidden ? "none" : undefined,
    })}
  >
    <details
      .open=${hidden || open === undefined ? nothing : open}
      @toggle=${onToggle || nothing}
    >
      <summary>
        <span>${name}</span>
      </summary>
    </details>
    <ul class="content">
      ${children}
    </ul>
  </li>`;
}
export type CollapseExpand = "collapse-all" | "expand-all";

export class CollapseExpandDecorator {
  callback?: (method: CollapseExpand) => void | Promise<void>;
  collapseExpandEl?: HTMLElement;

  constructor(
    readonly search: SearchComponent,
    initialValue: CollapseExpand = "expand-all",
  ) {
    this.setMethod(initialValue);
  }

  onClick(callback: (method: CollapseExpand) => void | Promise<void>): this {
    this.callback = callback;
    return this;
  }

  setMethod(method: CollapseExpand) {
    if (this.collapseExpandEl) {
      if (this.collapseExpandEl.hasClass(method)) {
        // No changes needed.
        return;
      } else {
        this.collapseExpandEl.remove();
        this.collapseExpandEl = undefined;
      }
    }
    this.search.addRightDecorator((el) => {
      this.collapseExpandEl = el;
      el.addClass("clickable-icon", method);
      setIcon(
        el,
        method === "collapse-all" ? "chevrons-down-up" : "chevrons-up-down",
      );
      setTooltip(
        el,
        method === "collapse-all" ? "Collapse all" : "Expand all",
        { placement: "top" },
      );
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this.callback?.(method);
      });
    });
  }
}
export function renderRuleset({
  open,
  name,
  children,
  onToggle,
}: {
  open?: boolean;
  name: string;
  children: unknown;
  onToggle?: (ev: ToggleEvent) => void | Promise<void>;
}): TemplateResult {
  return html`
    <li class="ruleset">
      <details ?open=${open} @toggle=${onToggle || nothing}>
        <summary><span>${name}</span></summary>
      </details>
      <ul class="content">
        ${children}
      </ul>
    </li>
  `;
}
