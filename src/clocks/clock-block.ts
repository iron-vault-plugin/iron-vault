import { html, render, svg } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { range } from "lit-html/directives/range.js";

import IronVaultPlugin from "index";
import { EventRef, MarkdownRenderChild } from "obsidian";
import { Left } from "utils/either";
import { vaultProcess } from "utils/obsidian";
import { md } from "utils/ui/directives";
import { ClockFileAdapter, clockUpdater } from "./clock-file";

export default function registerClockBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-clock",
    async (_source: string, el: HTMLElement, ctx) => {
      const renderer = new ClockRenderer(el, ctx.sourcePath, plugin);
      ctx.addChild(renderer);
      renderer.render();
    },
  );
}

class ClockRenderer extends MarkdownRenderChild {
  sourcePath: string;
  plugin: IronVaultPlugin;
  fileWatcher?: EventRef;

  constructor(
    containerEl: HTMLElement,
    sourcePath: string,
    plugin: IronVaultPlugin,
  ) {
    super(containerEl);
    this.sourcePath = sourcePath;
    this.plugin = plugin;
  }

  async onload() {
    if (this.fileWatcher) {
      this.plugin.clockIndex.offref(this.fileWatcher);
    }
    this.registerEvent(
      (this.fileWatcher = this.plugin.clockIndex.on(
        "changed",
        (changedPath) => {
          if (changedPath === this.sourcePath) {
            this.render();
          }
        },
      )),
    );
    this.render();
  }

  render() {
    const result =
      this.plugin.clockIndex.get(this.sourcePath) ??
      Left.create(new Error("clock not indexed"));
    if (result.isLeft()) {
      render(
        html`<pre>Error rendering clock: ${result.error.message}</pre>`,
        this.containerEl,
      );
      return;
    }
    this.renderClock(result.value);
  }

  renderClock(clockFile: ClockFileAdapter) {
    const tpl = html`
      <article class="iron-vault-clock">
        <h3 class="clock-name">
          ${md(this.plugin, clockFile.name, this.sourcePath)}
        </h3>

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
