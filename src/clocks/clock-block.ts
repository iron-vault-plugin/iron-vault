import { html, render } from "lit-html";

import IronVaultPlugin from "index";
import { vaultProcess } from "utils/obsidian";
import { md } from "utils/ui/directives";
import { TrackedEntityRenderer } from "utils/ui/tracked-entity-renderer";
import { ZodError } from "zod";
import { Clock } from "./clock";
import { ClockFileAdapter, clockUpdater } from "./clock-file";
import { clockWidget } from "./ui/clock-widget";

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
    super(containerEl, sourcePath, plugin, plugin.clocks, "clock");
  }

  renderEntity(clockFile: ClockFileAdapter) {
    const tpl = html`
      <article class="iron-vault-clock">
        <header class="clock-name">
          ${this.editingName
            ? html`<input
                type="text"
                .value=${clockFile.name}
                @click=${(ev: Event) => {
                  ev.stopPropagation(); // See notes in track-block.ts
                }}
                @blur=${async () => {
                  this.editingName = false;
                  setTimeout(() => this.render(), 0);
                }}
                @change=${async (ev: Event) => {
                  if (ev.target) {
                    await clockUpdater(
                      vaultProcess(this.plugin.app, this.sourcePath),
                      (clockFile) =>
                        clockFile.updatingClock((clock) =>
                          clock.withName((ev.target as HTMLInputElement).value),
                        ),
                    );
                  }
                  this.editingName = false;
                }}
              />`
            : html`<span
                @click=${(ev: Event) => {
                  ev.stopPropagation(); // See notes in track-block.ts
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

        ${clockWidget(clockFile.clock, (newProgress) =>
          this.updateClockProgress({
            progress: newProgress,
          }),
        )}

        <div
          class="clock-segments"
          @click=${(ev: Event) => {
            const target = ev.currentTarget as HTMLElement | null;
            ev.stopPropagation();
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
                @click=${(ev: Event) => {
                  ev.stopPropagation(); // See notes in track-block.ts
                }}
                @blur=${() => {
                  this.editingSegments = false;
                  setTimeout(() => this.render(), 0);
                }}
                @change=${async (ev: Event) => {
                  if (ev.target) {
                    await clockUpdater(
                      vaultProcess(this.plugin.app, this.sourcePath),
                      (clockFile) =>
                        clockFile.updatingClock((clock) =>
                          clock.withSegments(
                            +(ev.target as HTMLInputElement).value,
                          ),
                        ),
                    );
                  }
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
              @click=${(ev: Event) => {
                ev.stopPropagation(); // See notes in track-block.ts
              }}
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
