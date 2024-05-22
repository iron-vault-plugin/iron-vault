import { render, html } from "lit-html";

import ForgedPlugin from "index";
import { ChallengeRanks, ProgressTrack } from "./progress";
import { EventRef, TFile } from "obsidian";

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

interface TrackFrontmatter {
  name?: string;
  description?: string;
  rank?: ChallengeRanks;
  progress?: number;
  tracktype?: string;
  completed?: boolean;
  unbounded?: boolean;
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
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter) {
      render(
        html`<pre>Error rendering track: no frontmatter found.</pre>`,
        this.contentEl,
      );
      return;
    }
    const res = ProgressTrack.create(frontmatter);
    if (res.isLeft()) {
      render(
        html`<pre>Error rendering track: ${res.error.message}</pre>`,
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
    await this.renderProgress(res.value, file);
  }
  getFrontMatter(file: TFile): TrackFrontmatter | undefined {
    const fm = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) {
      render(
        html`<pre>Error rendering track: no frontmatter found.</pre>`,
        this.contentEl,
      );
      return;
    }
    return fm;
  }

  async renderProgress(prog: ProgressTrack, file: TFile) {
    const frontmatter = this.getFrontMatter(file);
    if (!frontmatter) {
      return;
    }
    const items = [];
    for (let i = 0; i < 10; i++) {
      const ticks = Math.max(Math.min(prog.progress - i * 4, 4), 0);
      items.push(html`<li data-value="${ticks}">box ${ticks}</li>`);
    }
    const tpl = html`
      <article class="forged-track">
        <h2>${frontmatter.name}</h2>
        <h4>${frontmatter.rank?.toLowerCase()}</h4>
        <div>
          <button
            type="button"
            @click=${() => this.updateTrackTicks(file, prog, { steps: -1 })}
          >
            -
          </button>
          <ol>
            ${items}
          </ol>
          <button
            type="button"
            @click=${() => this.updateTrackTicks(file, prog, { steps: 1 })}
          >
            +
          </button>
          <input
            .value="${prog.progress}"
            @change=${(ev: Event) =>
              this.updateTrackTicks(file, prog, {
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
    prog: ProgressTrack,
    { steps, ticks }: { steps?: number; ticks?: number },
  ) {
    const newProg = ticks ? prog.withTicks(ticks) : prog.advanced(steps!);
    this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm.progress = newProg.progress;
    });
    await this.renderProgress(newProg, file);
  }
}
