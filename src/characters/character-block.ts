import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import Sortable from "sortablejs";

import { Asset } from "@datasworn/core/dist/Datasworn";
import IronVaultPlugin from "index";
import { EventRef, TFile } from "obsidian";
import { ProgressTrack, legacyTrackXpEarned } from "tracks/progress";
import { renderTrack } from "tracks/track-block";
import { Lens } from "utils/lens";
import { vaultProcess } from "utils/obsidian";
import { CharacterContext } from "../character-tracker";
import renderAssetCard from "./asset-card";
import { addOrUpdateViaDataswornAsset } from "./assets";
import { ValidatedCharacter, momentumOps } from "./lens";
import { addAssetToCharacter } from "./commands";

export default function registerCharacterBlocks(plugin: IronVaultPlugin): void {
  registerBlock();
  registerBlock("info", CharacterSheetSection.INFO);
  registerBlock("stats", CharacterSheetSection.STATS);
  registerBlock("meters", CharacterSheetSection.METERS);
  registerBlock("special-tracks", CharacterSheetSection.SPECIAL_TRACKS);
  registerBlock("impacts", CharacterSheetSection.IMPACTS);
  registerBlock("assets", CharacterSheetSection.ASSETS);

  function registerBlock(
    languageSuffix?: string,
    section?: CharacterSheetSection,
  ) {
    plugin.registerMarkdownCodeBlockProcessor(
      "iron-vault-character" + (languageSuffix ? "-" + languageSuffix : ""),
      async (source: string, el: CharacterContainerEl, ctx) => {
        // We can't render blocks until datastore is ready.
        await plugin.datastore.waitForReady;
        if (!el.characterRenderer) {
          el.characterRenderer = new CharacterRenderer(
            el,
            source,
            plugin,
            section && [section],
          );
        }
        const file = plugin.app.vault.getFileByPath(ctx.sourcePath);
        await el.characterRenderer.render(file);
      },
    );
  }
}

interface CharacterContainerEl extends HTMLElement {
  characterRenderer?: CharacterRenderer;
}

enum CharacterSheetSection {
  INFO = "character-info",
  STATS = "stats",
  METERS = "meters",
  SPECIAL_TRACKS = "special-tracks",
  IMPACTS = "impacts",
  ASSETS = "assets",
}

class CharacterRenderer {
  contentEl: HTMLElement;
  source: string;
  plugin: IronVaultPlugin;
  sections: CharacterSheetSection[];
  fileWatcher?: EventRef;

  constructor(
    contentEl: HTMLElement,
    source: string,
    plugin: IronVaultPlugin,
    sections: CharacterSheetSection[] = [
      CharacterSheetSection.INFO,
      CharacterSheetSection.STATS,
      CharacterSheetSection.METERS,
      CharacterSheetSection.SPECIAL_TRACKS,
      CharacterSheetSection.IMPACTS,
      CharacterSheetSection.ASSETS,
    ],
  ) {
    this.contentEl = contentEl;
    this.source = source;
    this.plugin = plugin;
    this.sections = sections;
  }

  async render(file: TFile | undefined | null) {
    if (!file) {
      render(
        html`<pre>Error rendering character: no file found.</pre>`,
        this.contentEl,
      );
      return;
    }
    const character = this.plugin.characters.get(file.path);
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
    if (!character || character.isLeft()) {
      render(
        // TODO: we should preserve the error?
        //html`<pre>Error rendering clock: ${res.error.message}</pre>`,
        html`<pre>
Error rendering character: character file is invalid${character
            ? ": " + character.error.message
            : ""}</pre
        >`,
        this.contentEl,
      );
      return;
    } else if (character.isRight()) {
      await this.renderCharacter(character.value, file, false);
    }
  }

  async renderCharacter(
    charCtx: CharacterContext,
    file: TFile,
    readOnly: boolean = false,
  ) {
    const tpl = html`
      <article class="iron-vault-character">
        ${this.sections.includes(CharacterSheetSection.INFO)
          ? this.renderCharacterInfo(charCtx, file)
          : null}
        ${this.sections.includes(CharacterSheetSection.STATS)
          ? this.renderStats(charCtx, file)
          : null}
        ${this.sections.includes(CharacterSheetSection.METERS)
          ? this.renderMeters(charCtx, file)
          : null}
        ${this.sections.includes(CharacterSheetSection.SPECIAL_TRACKS)
          ? this.renderSpecialTracks(charCtx, file)
          : null}
        ${this.sections.includes(CharacterSheetSection.IMPACTS)
          ? this.renderImpacts(charCtx, file, readOnly)
          : null}
        ${this.sections.includes(CharacterSheetSection.ASSETS)
          ? this.renderAssets(charCtx, file)
          : null}
      </article>
    `;
    render(tpl, this.contentEl);
  }

  renderCharacterInfo(charCtx: CharacterContext, file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const charFieldUpdater = (
      lens:
        | Lens<ValidatedCharacter, string>
        | Lens<ValidatedCharacter, string | undefined>,
    ) => {
      return (e: Event) => {
        const target = e.target as HTMLInputElement;
        charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
          lens.update(char, target.value),
        );
      };
    };
    const charNumFieldUpdater = (lens: Lens<ValidatedCharacter, number>) => {
      return (e: Event) => {
        const target = e.target as HTMLInputElement;
        charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
          lens.update(char, +target.value),
        );
      };
    };
    return html`<section class="character-info">
      <header class="name">
        <input
          type="text"
          .value=${lens.name.get(raw)}
          @change=${charFieldUpdater(lens.name)}
        />
      </header>
      <dl>
        <dt>Callsign</dt>
        <dd class="callsign">
          <input
            type="text"
            placeholder="Raven"
            .value=${lens.callsign.get(raw) || ""}
            @change=${charFieldUpdater(lens.callsign)}
          />
        </dd>
        <dt>Pronouns</dt>
        <dd class="pronouns">
          <input
            type="text"
            placeholder="They/them"
            .value=${lens.pronouns.get(raw) || ""}
            @change=${charFieldUpdater(lens.pronouns)}
          />
        </dd>
        <dt>Description</dt>
        <dd class="description">
          <input
            type="text"
            placeholder="About Me"
            .value=${lens.description.get(raw) || ""}
            @change=${charFieldUpdater(lens.description)}
          />
        </dd>
        <dt>XP Earned</dt>
        <dd class="xp-earned">
          ${Object.values(lens.special_tracks).reduce((acc, track) => {
            return acc + legacyTrackXpEarned(track.get(raw));
          }, 0)}
        </dd>
        <dt>XP Spent</dt>
        <dd class="xp-spent">
          <input
            type="number"
            .value=${lens.xp_spent.get(raw) || ""}
            @change=${charNumFieldUpdater(lens.xp_spent)}
          />
        </dd>
      </dl>
    </section>`;
  }

  renderStats(charCtx: CharacterContext, file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const statUpdater = (lens: Lens<ValidatedCharacter, number>) => {
      return (e: Event) => {
        const target = e.target as HTMLInputElement;
        charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
          lens.update(char, +target.value),
        );
      };
    };
    return html`
      <ul class="stats">
        ${map(
          Object.entries(lens.stats),
          ([stat, value]) => html`
            <li>
              <dl>
                <dt data-value=${stat}>${stat}</dt>
                <dd data-value=${value.get(raw)}>
                  <input
                    type="number"
                    .value=${value.get(raw)}
                    @change=${statUpdater(lens.stats[stat])}
                  />
                </dd>
              </dl>
            </li>
          `,
        )}
      </ul>
    `;
  }

  renderMeters(charCtx: CharacterContext, file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const updateMeter = (
      lens: Lens<ValidatedCharacter, number>,
      delta: number,
    ) => {
      charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
        lens.update(char, lens.get(raw) + delta),
      );
    };
    const momOps = momentumOps(lens);
    const updateMomentum = (delta?: number) => {
      charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
        delta == null
          ? momOps.reset(char)
          : delta >= 0
            ? momOps.take(delta)(char)
            : momOps.suffer(delta * -1)(char),
      );
    };
    return html`
      <ul class="meters">
        ${map(
          Object.entries(lens.condition_meters),
          ([meter, value]) => html`
            <li>
              <dl>
                <dt data-value=${meter}>${meter}</dt>
                <dd data-value=${value.get(raw)}>
                  <button type="button" @click=${() => updateMeter(value, -1)}>
                    -
                  </button>
                  <span>${value.get(raw)}</span>
                  <button type="button" @click=${() => updateMeter(value, +1)}>
                    +
                  </button>
                </dd>
              </dl>
            </li>
          `,
        )}
        <li class="momentum">
          <dl>
            <dt>momentum</dt>
            <dd data-value=${lens.momentum.get(raw)}>
              <button type="button" @click=${() => updateMomentum(-1)}>
                -
              </button>
              <span>${lens.momentum.get(raw)}</span>
              <button type="button" @click=${() => updateMomentum(+1)}>
                +
              </button>
            </dd>
          </dl>
          <button type="button" @click=${() => updateMomentum()}>Reset</button>
        </li>
      </ul>
    `;
  }

  renderImpacts(charCtx: CharacterContext, file: TFile, readOnly: boolean) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const categories: Record<string, Record<string, boolean>> = {};
    for (const [impact, value] of Object.entries(lens.impacts.get(raw))) {
      const category = lens.ruleset.impacts[impact].category.label;
      if (!categories[category]) {
        categories[category] = {};
      }
      categories[category][impact] = value;
    }
    const toggleImpact = (
      lens: Lens<ValidatedCharacter, Record<string, boolean>>,
      impact: string,
    ) => {
      charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
        lens.update(char, {
          ...lens.get(raw),
          [impact]: !lens.get(raw)[impact],
        }),
      );
    };
    return html`
      <ul class="impact-categories">
        ${map(
          Object.entries(categories),
          ([impact, value]) => html`
            <li>
              <header>${impact}</header>
              <ul class="impacts">
                ${map(
                  Object.entries(value),
                  ([impact, value]) => html`
                    <li>
                      <label>
                        <input
                          name=${impact}
                          type="checkbox"
                          ?checked=${value}
                          ?disabled=${readOnly}
                          .value=${value}
                          @click=${() => toggleImpact(lens.impacts, impact)}
                        />
                        <span>${impact.replaceAll(/_/g, " ")}</span>
                      </label>
                    </li>
                  `,
                )}
              </ul>
            </li>
          `,
        )}
      </ul>
    `;
  }

  renderSpecialTracks(charCtx: CharacterContext, file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const updateTrack = (
      track: Lens<ValidatedCharacter, ProgressTrack>,
      info: { steps?: number; ticks?: number },
    ) => {
      charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
        track.update(
          char,
          info.steps == null
            ? track.get(raw).withTicks(info.ticks!)
            : track.get(raw).advanced(info.steps),
        ),
      );
    };
    return html`
      <ul class="special-tracks">
        ${map(
          Object.entries(lens.special_tracks),
          ([name, value]) => html`
            <li>
              ${renderTrack(
                this.plugin,
                {
                  name: capitalize(lens.ruleset.special_tracks[name].label),
                  trackType: "special track",
                  track: value.get(raw),
                },
                (info: { steps?: number; ticks?: number }) =>
                  updateTrack(value, info),
                false,
                legacyTrackXpEarned(value.get(raw)),
              )}
            </li>
          `,
        )}
      </ul>
    `;
  }

  renderAssets(charCtx: CharacterContext, file: TFile) {
    const lens = charCtx.lens;
    const raw = charCtx.character;

    const updateAsset = (asset: Asset) => {
      charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
        addOrUpdateViaDataswornAsset(lens, this.plugin.datastore).update(
          char,
          asset,
        ),
      );
    };

    const removeAsset = (asset: { id: string }) => {
      charCtx.updater(vaultProcess(this.plugin.app, file.path), (char) =>
        lens.assets.update(
          char,
          lens.assets.get(char).filter((a) => a.id !== asset.id),
        ),
      );
    };

    const makeSortable = (el?: Element) => {
      if (el && !Sortable.get(el as HTMLElement)) {
        Sortable.create(el as HTMLElement, {
          animation: 150,
          handle: ".iron-vault-asset-card > header",
        });
      }
    };

    return html`
      <ul class="assets" ${ref(makeSortable)}>
        ${map(
          Object.values(lens.assets.get(raw)),
          (asset) => html`
            <li class="asset-card-wrapper">
              <button
                type="button"
                class="remove-asset"
                @click=${() => removeAsset(asset)}
              >
                ✕
              </button>
              ${renderAssetCard(this.plugin, asset, updateAsset)}
            </li>
          `,
        )}
        <li>
          <button
            class="add-asset"
            type="button"
            @click=${() => addAssetToCharacter(this.plugin)}
          >
            Add Asset
          </button>
        </li>
      </ul>
    `;
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
