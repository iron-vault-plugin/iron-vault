import { html, render } from "lit-html";
import { md } from "utils/ui/directives";

import IronVaultPlugin from "index";
import { EventRef, MarkdownRenderChild } from "obsidian";
import { Left } from "utils/either";
import { vaultProcess } from "utils/obsidian";
import { capitalize } from "utils/strings";
import {
  ChallengeRanks,
  ProgressTrack,
  ProgressTrackFileAdapter,
  ProgressTrackInfo,
} from "./progress";
import { progressTrackUpdater } from "./writer";

export default function registerTrackBlock(plugin: IronVaultPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-track",
    async (_source: string, el: HTMLElement, ctx) => {
      const renderer = new TrackRenderer(el, ctx.sourcePath, plugin);
      ctx.addChild(renderer);
      renderer.render();
    },
  );
}

class TrackRenderer extends MarkdownRenderChild {
  sourcePath: string;
  plugin: IronVaultPlugin;
  fileWatcher?: EventRef;
  editingName = false;

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
      renderTrack(
        this.plugin,
        trackFile,
        (incr) => this.updateTrack(incr),
        undefined,
        undefined,
        this,
      ),
      this.containerEl,
    );
  }

  async updateTrack({
    name,
    rank,
    trackType,
    steps,
    ticks,
  }: {
    name?: string;
    rank?: ChallengeRanks;
    trackType?: string;
    steps?: number;
    ticks?: number;
  }) {
    await progressTrackUpdater(
      vaultProcess(this.plugin.app, this.sourcePath),
      (trackFile) => {
        const updatedFile = trackFile.updatingTrack((track) => {
          const advanced =
            ticks != null ? track.withTicks(ticks) : track.advanced(steps ?? 0);
          return ProgressTrack.create_({
            rank: rank ?? advanced.rank,
            progress: advanced.progress,
            complete: advanced.complete,
            unbounded: advanced.unbounded,
          });
        });
        return ProgressTrackFileAdapter.newFromTrack({
          name: name ?? updatedFile.name,
          trackType: trackType ?? updatedFile.trackType,
          track: updatedFile.track,
        }).expect("failed to update track");
      },
    );
  }
}

export function renderTrack(
  plugin: IronVaultPlugin,
  info: ProgressTrackInfo,
  updateTrack: (incr: {
    name?: string;
    rank?: ChallengeRanks;
    trackType?: string;
    steps?: number;
    ticks?: number;
  }) => void,
  showTrackInfo: boolean = true,
  xpEarned?: number,
  trackRenderer?: TrackRenderer,
) {
  const items = [];
  for (let i = 0; i < 10; i++) {
    const ticks = Math.max(Math.min(info.track.progress - i * 4, 4), 0);
    items.push(html`<li data-value="${ticks}">box ${ticks}</li>`);
  }
  const tpl = html`
    <article class="iron-vault-track">
      <header class="track-name">
        ${trackRenderer?.editingName
          ? html`<textarea
              type="text"
              .value=${info.name}
              @blur=${() => {
                trackRenderer.editingName = false;
                setTimeout(() => trackRenderer?.render(), 0);
              }}
              @change=${(ev: Event) => {
                updateTrack({
                  name: (ev.target! as HTMLInputElement).value,
                });
              }}
            />`
          : html`<span
              @click=${() => {
                if (!trackRenderer) {
                  return;
                }
                trackRenderer.editingName = true;
                trackRenderer.render();
                const el = trackRenderer.containerEl.querySelector(
                  ".track-name textarea",
                ) as HTMLElement | undefined;
                el?.focus();
              }}
            >
              ${md(plugin, info.name)}</span
            >`}
      </header>
      ${showTrackInfo
        ? html`
            <div class="track-info">
              <span class="track-rank">
                ${trackRenderer
                  ? html`<select
                      .value=${info.track.rank}
                      @change=${(ev: Event) =>
                        updateTrack({
                          rank: (ev.target! as HTMLSelectElement)
                            .value as ChallengeRanks,
                        })}
                    >
                      ${Object.values(ChallengeRanks).map(
                        (rank) =>
                          html`<option
                            ?selected=${rank === info.track.rank}
                            value=${rank}
                          >
                            ${capitalize(rank)}
                          </option>`,
                      )}
                    </select>`
                  : html`${capitalize(info.track.rank)}`}
              </span>
              <span class="track-type">
                ${trackRenderer
                  ? html`<input
                      type="text"
                      .value=${info.trackType}
                      @change=${(ev: Event) =>
                        updateTrack({
                          trackType: (ev.target! as HTMLSelectElement).value,
                        })}
                    /> `
                  : html`${capitalize(info.trackType)}`}
              </span>
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
