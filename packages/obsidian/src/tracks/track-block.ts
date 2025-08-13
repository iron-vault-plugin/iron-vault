import { html, render } from "lit-html";
import { md } from "utils/ui/directives";

import IronVaultPlugin from "index";
import { UnexpectedIndexingError } from "indexer/indexer";
import { vaultProcess } from "utils/obsidian";
import { capitalize } from "utils/strings";
import { TrackedEntityRenderer } from "utils/ui/tracked-entity-renderer";
import { ZodError } from "zod";
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
    },
  );
}

class TrackRenderer extends TrackedEntityRenderer<
  ProgressTrackFileAdapter,
  ZodError | UnexpectedIndexingError
> {
  editingName = false;

  constructor(
    containerEl: HTMLElement,
    sourcePath: string,
    plugin: IronVaultPlugin,
  ) {
    super(containerEl, sourcePath, plugin, plugin.progressTracks, "track");
  }

  renderEntity(trackFile: ProgressTrackFileAdapter) {
    render(
      renderTrack(
        this.plugin,
        trackFile,
        this.updateTrack.bind(this),
        undefined,
        undefined,
        this,
      ),
      this.containerEl,
    );
  }

  async updateName(name: string) {
    return this.updateTrackFile((trackFile) => trackFile.withName(name));
  }

  async updateTrackCompletion(completion: boolean) {
    return this.updateTrack((_) => _.withCompletion(completion));
  }

  async updateTrack(updateFn: (track: ProgressTrack) => ProgressTrack) {
    await this.updateTrackFile((trackFile) =>
      trackFile.updatingTrack(updateFn),
    );
  }

  async updateTrackType(trackType: string) {
    return this.updateTrackFile((trackFile) =>
      trackFile.withTrackType(trackType),
    );
  }

  async updateTrackFile(
    updateFn: (trackFile: ProgressTrackFileAdapter) => ProgressTrackFileAdapter,
  ) {
    await progressTrackUpdater(
      vaultProcess(this.plugin.app, this.sourcePath),
      updateFn,
    );
  }
}

export function renderTrack(
  plugin: IronVaultPlugin,
  info: ProgressTrackInfo,
  updateTrack: (
    updateFn: (track: ProgressTrack) => ProgressTrack,
  ) => void | Promise<void>,
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
              @click=${(ev: Event) => {
                ev.stopPropagation(); // Prevents the click event from bubbling
              }}
              @blur=${() => {
                trackRenderer.editingName = false;
                setTimeout(() => trackRenderer?.render(), 0);
              }}
              @change=${(ev: Event) => {
                trackRenderer.updateName(
                  (ev.target! as HTMLTextAreaElement).value,
                );
              }}
            />`
          : html`<span
              @click=${(ev: Event) => {
                if (!trackRenderer) {
                  return;
                }
                ev.stopPropagation();
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
                      @click=${(ev: Event) => {
                        // When track is embedded, bubbling the click event causes
                        // Obsidian to change the selection, which ends up removing
                        // focus from the select element. This prevents that.
                        ev.stopPropagation();
                      }}
                      @change=${(ev: Event) =>
                        updateTrack((_) =>
                          _.withRank(
                            (ev.target! as HTMLSelectElement)
                              .value as ChallengeRanks,
                          ),
                        )}
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
                      @click=${(ev: Event) => {
                        ev.stopPropagation(); // See above
                      }}
                      @change=${(ev: Event) =>
                        trackRenderer.updateTrackType(
                          (ev.target! as HTMLInputElement).value,
                        )}
                    /> `
                  : html`${capitalize(info.trackType)}`}
              </span>
              <span class="track-completion">
                ${trackRenderer
                  ? html`<input
                      type="checkbox"
                      .checked=${info.track.complete}
                      @click=${(ev: Event) => {
                        ev.stopPropagation(); // See above
                      }}
                      @change=${(ev: Event) =>
                        trackRenderer.updateTrackCompletion(
                          (ev.target! as HTMLInputElement).checked,
                        )}
                    /> `
                  : html`${info.track.complete ? "Complete" : "Incomplete"}`}
              </span>
            </div>
          `
        : null}
      ${xpEarned != null
        ? html`<span class="track-xp">${xpEarned}</span>`
        : null}
      <div class="track-widget">
        <button
          type="button"
          @click=${(ev: Event) => {
            ev.stopPropagation();
            updateTrack((track) => track.advanced(-1));
          }}
        >
          -
        </button>
        <ol>
          ${items}
        </ol>
        <button
          type="button"
          @click=${(ev: Event) => {
            ev.stopPropagation();
            updateTrack((track) => track.advanced(1));
          }}
        >
          +
        </button>
        <input
          .value="${info.track.progress}"
          @click=${(ev: Event) => {
            ev.stopPropagation(); // See above
          }}
          @change=${(ev: Event) =>
            updateTrack((track) =>
              track.advancedByTicks(+(ev.target! as HTMLInputElement).value),
            )}
        />
        <span>ticks</span>
      </div>
    </article>
  `;
  return tpl;
}
