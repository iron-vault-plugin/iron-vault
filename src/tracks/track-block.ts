import { html, render } from "lit-html";
import { md } from "utils/ui/directives";

import IronVaultPlugin from "index";
import { EventRef, MarkdownRenderChild } from "obsidian";
import { Left } from "utils/either";
import { vaultProcess } from "utils/obsidian";
import { capitalize } from "utils/strings";
import { ProgressTrackFileAdapter, ProgressTrackInfo } from "./progress";
import { progressTrackUpdater } from "./writer";

export default function registerTrackBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-track",
    (_source: string, el: HTMLElement, ctx) => {
      ctx.addChild(new TrackRenderer(el, ctx.sourcePath, plugin));
    },
  );
}

class TrackRenderer extends MarkdownRenderChild {
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
      this.plugin.progressIndex.offref(this.fileWatcher);
    }
    this.registerEvent(
      (this.fileWatcher = this.plugin.progressIndex.on(
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
      this.plugin.progressIndex.get(this.sourcePath) ??
      Left.create(new Error("track not indexed"));
    if (result.isLeft()) {
      render(
        html`<pre>Error rendering track: ${result.error.message}</pre>`,
        this.containerEl,
      );
      return;
    }
    this.renderProgress(result.value);
  }

  renderProgress(trackFile: ProgressTrackFileAdapter) {
    render(
      renderTrack(this.plugin, trackFile, (incr) =>
        this.updateTrackTicks(incr),
      ),
      this.containerEl,
    );
  }

  async updateTrackTicks({ steps, ticks }: { steps?: number; ticks?: number }) {
    await progressTrackUpdater(
      vaultProcess(this.plugin.app, this.sourcePath),
      (trackFile) =>
        trackFile.updatingTrack((track) =>
          ticks ? track.withTicks(ticks) : track.advanced(steps!),
        ),
    );
  }
}

export function renderTrack(
  plugin: IronVaultPlugin,
  info: ProgressTrackInfo,
  updateTrack: (incr: { steps?: number; ticks?: number }) => void,
  showTrackInfo: boolean = true,
  xpEarned?: number,
) {
  const items = [];
  for (let i = 0; i < 10; i++) {
    const ticks = Math.max(Math.min(info.track.progress - i * 4, 4), 0);
    items.push(html`<li data-value="${ticks}">box ${ticks}</li>`);
  }
  const tpl = html`
    <article class="iron-vault-track">
      <header class="track-name">${md(plugin, info.name)}</header>
      ${showTrackInfo
        ? html`
            <div class="track-info">
              <span class="track-rank">${capitalize(info.track.rank)}</span>
              <span class="track-type">${capitalize(info.trackType)}</span>
            </div>
          `
        : null}
      ${xpEarned != null
        ? html`<span class="track-xp">${xpEarned}</span>`
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
