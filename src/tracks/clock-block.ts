import { html, render, svg } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { range } from "lit-html/directives/range.js";

import ForgedPlugin from "index";
import { EventRef, TFile } from "obsidian";
import { vaultProcess } from "utils/obsidian";
import { ClockFileAdapter, clockUpdater } from "./clock-file";
import { md } from "utils/ui/directives";

export default function registerClockBlock(plugin: ForgedPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "forged-clock",
    async (source: string, el: ClockContainerEl, ctx) => {
      // We can't render blocks until datastore is ready.
      await plugin.datastore.waitForReady;
      if (!el.clockRenderer) {
        el.clockRenderer = new ClockRenderer(el, source, plugin);
      }
      const file = plugin.app.vault.getFileByPath(ctx.sourcePath);
      await el.clockRenderer.render(file);
    },
  );
}

interface ClockContainerEl extends HTMLElement {
  clockRenderer?: ClockRenderer;
}

class ClockRenderer {
  contentEl: HTMLElement;
  source: string;
  plugin: ForgedPlugin;
  fileWatcher?: EventRef;

  constructor(contentEl: HTMLElement, source: string, plugin: ForgedPlugin) {
    this.contentEl = contentEl;
    this.source = source;
    this.plugin = plugin;
  }

  async render(file: TFile | undefined | null) {
    if (!file) {
      render(
        html`<pre>Error rendering clock: no file found.</pre>`,
        this.contentEl,
      );
      return;
    }
    const clock = this.plugin.clockIndex.get(file.path);
    if (this.fileWatcher) {
      this.plugin.app.metadataCache.offref(this.fileWatcher);
    }
    this.fileWatcher = this.plugin.app.metadataCache.on(
      "changed",
      (moddedFile) => {
        if (moddedFile.path === file.path) {
          this.render(moddedFile);
        }
      },
    );
    this.plugin.registerEvent(this.fileWatcher);
    if (!clock) {
      render(
        // TODO: we should preserve the error?
        //html`<pre>Error rendering clock: ${res.error.message}</pre>`,
        html`<pre>Error rendering clock: clock file is invalid</pre>`,
        this.contentEl,
      );
      return;
    }
    await this.renderClock(clock, file);
  }

  async renderClock(clockFile: ClockFileAdapter, file: TFile) {
    const tpl = html`
      <article class="forged-clock">
        <h3 class="clock-name">
          ${md(this.plugin, clockFile.name, file.path)}
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
            this.renderPath(i, clockFile, file),
          )}
        </svg>
      </article>
    `;
    render(tpl, this.contentEl);
  }

  renderPath(i: number, clockFile: ClockFileAdapter, file: TFile) {
    return svg`<path
      d="${pathString(i, clockFile.clock.segments)}"
      class="clock-segment svg"
      aria-selected="${clockFile.clock.progress === i + 1}"
      @click=${() => this.updateClockProgress(file, { progress: i === 0 && clockFile.clock.progress === 1 ? 0 : i + 1 })}
    ></path>`;
  }

  async updateClockProgress(
    file: TFile,
    { steps, progress }: { steps?: number; progress?: number },
  ) {
    const newProg = await clockUpdater(
      vaultProcess(this.plugin.app, file.path),
      (clockFile) =>
        clockFile.updatingClock((clock) =>
          progress != null ? clock.withProgress(progress) : clock.tick(steps!),
        ),
    );

    await this.renderClock(newProg, file);
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
