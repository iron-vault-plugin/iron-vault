import { html, render, svg } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { range } from "lit-html/directives/range.js";

import IronVaultPlugin from "index";
import { vaultProcess } from "utils/obsidian";
import { md } from "utils/ui/directives";
import { TrackedEntityRenderer } from "utils/ui/tracked-entity-renderer";
import { ZodError } from "zod";
import { Clock } from "./clock";
import { ClockFileAdapter, clockUpdater } from "./clock-file";

export default function registerClockBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-clock",
    async (_source: string, el: HTMLElement, ctx) => {
      const renderer = new ClockRenderer(el, ctx.sourcePath, plugin);
      ctx.addChild(renderer);
      // NOTE(@cwegrzyn): with debug logging, I haven't seen a case where we need this. But leaving
      // a note here to say that in the past, the ctx has no always been loaded. Calling load
      // on the renderer MAY be more appropriate in any case, because that's a no-op for a loaded
      // component.
      // renderer.render();
    },
  );
}

class ClockRenderer extends TrackedEntityRenderer<ClockFileAdapter, ZodError> {
  editingName = false;
  editingSegments = false;

  constructor(
    containerEl: HTMLElement,
    sourcePath: string,
    plugin: IronVaultPlugin,
  ) {
    super(containerEl, sourcePath, plugin, plugin.clockIndex, "clock");
  }

  renderEntity(clockFile: ClockFileAdapter) {
    const tpl = html`
      <article class="iron-vault-clock">
        <header class="clock-name">
          ${this.editingName
            ? html`<input
                type="text"
                .value=${clockFile.name}
                @blur=${async () => {
                  this.editingName = false;
                  setTimeout(() => this.render(), 0);
                }}
                @change=${async (ev: Event) => {
                  ev.target &&
                    (await clockUpdater(
                      vaultProcess(this.plugin.app, this.sourcePath),
                      (clockFile) =>
                        clockFile.updatingClock((clock) =>
                          clock.withName((ev.target as HTMLInputElement).value),
                        ),
                    ));
                  this.editingName = false;
                }}
              />`
            : html`<span
                @click=${() => {
                  this.editingName = true;
                  this.render();
                  const el = this.containerEl.querySelector(
                    ".clock-name input",
                  ) as HTMLElement | undefined;
                  el?.focus();
                }}
                >${md(this.plugin, clockFile.name, this.sourcePath)}</span
              >`}
        </header>

        <svg
          class="clock-widget"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="-55 -55 110 110"
          aria-valuenow=${clockFile.clock.progress}
          aria-valuetext="${clockFile.clock.progress}⁄${clockFile.clock
            .segments}"
        >
          ${map(range(clockFile.clock.segments), (i) =>
            this.renderPath(i, clockFile),
          )}
        </svg>

        <div
          class="clock-segments"
          @click=${(ev: Event) => {
            const target = ev.target as HTMLElement | undefined;
            if (target?.querySelector("span")) {
              this.editingSegments = true;
              this.render();
              target?.querySelector("input")?.focus();
            }
          }}
        >
          ${this.editingSegments
            ? html`<input
                type="number"
                .value=${clockFile.clock.segments}
                @blur=${() => {
                  this.editingSegments = false;
                  setTimeout(() => this.render(), 0);
                }}
                @change=${async (ev: Event) => {
                  ev.target &&
                    (await clockUpdater(
                      vaultProcess(this.plugin.app, this.sourcePath),
                      (clockFile) =>
                        clockFile.updatingClock((clock) =>
                          clock.withSegments(
                            +(ev.target as HTMLInputElement).value,
                          ),
                        ),
                    ));
                  this.editingName = false;
                }}
              />`
            : html`<span>${clockFile.clock.segments}</span>`}
          segments;
          <label
            >Complete:
            <input
              type="checkbox"
              ?checked=${!clockFile.clock.active}
              @change=${async (ev: Event) =>
                ev.target &&
                (await clockUpdater(
                  vaultProcess(this.plugin.app, this.sourcePath),
                  (clockFile) =>
                    clockFile.updatingClock((clock) =>
                      Clock.create({
                        active: !(ev.target as HTMLInputElement).checked,
                        progress: clock.progress,
                        segments: clock.segments,
                        name: clock.name,
                      }).expect("This should be fine."),
                    ),
                ))}
          /></label>
        </div>
      </article>
    `;
    render(tpl, this.containerEl);
  }

  renderPath(i: number, clockFile: ClockFileAdapter) {
    return svg`<path
      d="${pathString(i, clockFile.clock.segments)}"
      class="clock-segment svg"
      aria-selected="${clockFile.clock.progress === i + 1}"
      @click=${() => this.updateClockProgress({ progress: i === 0 && clockFile.clock.progress === 1 ? 0 : i + 1 })}
    ></path>`;
  }

  async updateClockProgress({
    steps,
    progress,
  }: {
    steps?: number;
    progress?: number;
  }) {
    await clockUpdater(
      vaultProcess(this.plugin.app, this.sourcePath),
      (clockFile) =>
        clockFile.updatingClock((clock) =>
          progress != null ? clock.withProgress(progress) : clock.tick(steps!),
        ),
    );
  }
}

const R = 50;

function pathString(wedgeIdx: number, numWedges: number) {
  const wedgeAngle = (2 * Math.PI) / numWedges;
  const startAngle = wedgeIdx * wedgeAngle - Math.PI / 2;
  const x1 = R * Math.cos(startAngle);
  const y1 = R * Math.sin(startAngle);
  const x2 = R * Math.cos(startAngle + wedgeAngle);
  const y2 = R * Math.sin(startAngle + wedgeAngle);

  return `M0,0 L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} z`;
}
