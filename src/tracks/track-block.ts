import { html, render } from "lit-html";
import { md } from "utils/ui/directives";

import IronVaultPlugin from "index";
import { EventRef, TFile } from "obsidian";
import { Left } from "utils/either";
import { vaultProcess } from "utils/obsidian";
import { ProgressTrackFileAdapter, ProgressTrackInfo } from "./progress";
import { progressTrackUpdater } from "./writer";

export default function registerTrackBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-track",
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
  plugin: IronVaultPlugin;
  fileWatcher?: EventRef;

  constructor(contentEl: HTMLElement, source: string, plugin: IronVaultPlugin) {
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

    const result =
      this.plugin.progressIndex.get(file.path) ??
      Left.create(new Error("track not indexed"));
    if (result.isLeft()) {
      render(
        html`<pre>Error rendering track: ${result.error.message}</pre>`,
        this.contentEl,
      );
      return;
    }
    await this.renderProgress(result.value, file);
  }

  async renderProgress(trackFile: ProgressTrackFileAdapter, file: TFile) {
    render(
      renderTrack(this.plugin, trackFile, (incr) =>
        this.updateTrackTicks(file, incr),
      ),
      this.contentEl,
    );
  }

  async updateTrackTicks(
    file: TFile,
    { steps, ticks }: { steps?: number; ticks?: number },
  ) {
    const newProg = await progressTrackUpdater(
      vaultProcess(this.plugin.app, file.path),
      (trackFile) =>
        trackFile.updatingTrack((track) =>
          ticks ? track.withTicks(ticks) : track.advanced(steps!),
        ),
    );

    await this.renderProgress(newProg, file);
  }
}

export function renderTrack(
  plugin: IronVaultPlugin,
  info: ProgressTrackInfo,
  updateTrack: (incr: { steps?: number; ticks?: number }) => void,
  showTrackInfo: boolean = true,
) {
  const items = [];
  for (let i = 0; i < 10; i++) {
    const ticks = Math.max(Math.min(info.track.progress - i * 4, 4), 0);
    items.push(html`<li data-value="${ticks}">box ${ticks}</li>`);
  }
  const tpl = html`
    <article class="iron-vault-track">
      <h3 class="track-name">${md(plugin, info.name)}</h3>
      ${showTrackInfo
        ? html`
            <h5>
              <span class="track-rank">${capitalize(info.track.rank)}</span>
              <span class="track-type">${capitalize(info.trackType)}</span>
            </h5>
          `
        : null}
      <div class="track-widget">
        <button type="button" @click=${() => updateTrack({ steps: -1 })}>
          -
        </button>
        <ol>
          ${items}
        </ol>
        <button type="button" @click=${() => updateTrack({ steps: 1 })}>
          +
        </button>
        <input
          .value="${info.track.progress}"
          @change=${(ev: Event) =>
            updateTrack({ ticks: +(ev.target! as HTMLInputElement).value })}
        />
        <span>ticks</span>
      </div>
    </article>
  `;
  return tpl;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
