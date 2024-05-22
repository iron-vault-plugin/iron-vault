import { html, render } from "lit-html";

import ForgedPlugin from "index";
import { EventRef, TFile } from "obsidian";
import { vaultProcess } from "utils/obsidian";
import { ProgressTrackFileAdapter } from "./progress";
import { progressTrackUpdater } from "./writer";

export default function registerTrackBlock(plugin: ForgedPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "forged-track",
    async (source: string, el: TrackContainerEl, ctx) => {
      // We can't render blocks until datastore is ready.
      await plugin.datastore.waitForReady;
      if (!el.trackRenderer) {
        el.trackRenderer = new TrackRenderer(el, source, plugin);
      }
      const file = plugin.app.vault.getFileByPath(ctx.sourcePath);
      await el.trackRenderer.render(file);
    },
  );
}

interface TrackContainerEl extends HTMLElement {
  trackRenderer?: TrackRenderer;
}

class TrackRenderer {
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
        html`<pre>Error rendering track: no file found.</pre>`,
        this.contentEl,
      );
      return;
    }
    const track = this.plugin.progressIndex.get(file.path);
    if (!track) {
      render(
        // TODO: we should preserve the error?
        //html`<pre>Error rendering track: ${res.error.message}</pre>`,
        html`<pre>Error rendering track: track file is invalid</pre>`,
        this.contentEl,
      );
      return;
    }
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
    await this.renderProgress(track, file);
  }

  async renderProgress(trackFile: ProgressTrackFileAdapter, file: TFile) {
    const items = [];
    for (let i = 0; i < 10; i++) {
      const ticks = Math.max(Math.min(trackFile.track.progress - i * 4, 4), 0);
      items.push(html`<li data-value="${ticks}">box ${ticks}</li>`);
    }
    const tpl = html`
      <article class="forged-track">
        <h2>${trackFile.name}</h2>
        <h4>${trackFile.track.rank}</h4>
        <div>
          <button
            type="button"
            @click=${() => this.updateTrackTicks(file, { steps: -1 })}
          >
            -
          </button>
          <ol>
            ${items}
          </ol>
          <button
            type="button"
            @click=${() => this.updateTrackTicks(file, { steps: 1 })}
          >
            +
          </button>
          <input
            .value="${trackFile.track.progress}"
            @change=${(ev: Event) =>
              this.updateTrackTicks(file, {
                ticks: +(ev.target! as HTMLInputElement).value,
              })}
          />
          ticks
        </div>
      </article>
    `;
    render(tpl, this.contentEl);
  }

  async updateTrackTicks(
    file: TFile,
    { steps, ticks }: { steps?: number; ticks?: number },
  ) {
    const newProg = await progressTrackUpdater(
      this.plugin.progressTrackSettings,
    )(vaultProcess(this.plugin.app, file.path), (trackFile) =>
      trackFile.updatingTrack((track) =>
        ticks ? track.withTicks(ticks) : track.advanced(steps!),
      ),
    );

    await this.renderProgress(newProg, file);
  }
}
