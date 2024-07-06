import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { ref } from "lit-html/directives/ref.js";
import { repeat } from "lit-html/directives/repeat.js";
import Sortable from "sortablejs";

import { Asset } from "@datasworn/core/dist/Datasworn";
import IronVaultPlugin from "index";
import { normalizePath } from "obsidian";
import { IronVaultPluginSettings } from "settings";
import { ProgressTrack, legacyTrackXpEarned } from "tracks/progress";
import { renderTrack } from "tracks/track-block";
import { Lens } from "utils/lens";
import { vaultProcess } from "utils/obsidian";
import { capitalize } from "utils/strings";
import {
  ALL_SETTINGS,
  TrackedEntityRenderer,
} from "utils/ui/tracked-entity-renderer";
import { ZodError } from "zod";
import { CharacterContext, setActiveCharacter } from "../character-tracker";
import renderAssetCard from "../assets/asset-card";
import { addOrUpdateViaDataswornAsset } from "./assets";
import { addAssetToCharacter } from "./commands";
import { CharacterLens, ValidatedCharacter, momentumOps } from "./lens";
import { CharacterActionContext } from "./action-context";

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
      (source: string, el: HTMLElement, ctx) => {
        const renderer = new CharacterRenderer(
          el,
          resolveSourceFileName(source) || ctx.sourcePath,
          plugin,
          section && [section],
        );
        ctx.addChild(renderer);
      },
    );
    function resolveSourceFileName(source: string) {
      const src = normalizePath(source.trim().split("\n")[0].trim());
      return (
        src !== "/" &&
        plugin.app.vault.getFiles().find((f) => f.path.contains(src))?.path
      );
    }
  }
}

enum CharacterSheetSection {
  INFO = "character-info",
  STATS = "stats",
  METERS = "meters",
  SPECIAL_TRACKS = "special-tracks",
  IMPACTS = "impacts",
  ASSETS = "assets",
}

class CharacterRenderer extends TrackedEntityRenderer<
  CharacterContext,
  ZodError
> {
  sections: CharacterSheetSection[];

  constructor(
    containerEl: HTMLElement,
    sourcePath: string,
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
    super(containerEl, sourcePath, plugin, plugin.characters, "character");
    this.sections = sections;
  }

  get watchedSettings():
    | Set<keyof IronVaultPluginSettings>
    | typeof ALL_SETTINGS {
    return ALL_SETTINGS;
  }

  renderEntity(charCtx: CharacterContext, readOnly: boolean = false) {
    const tpl = html`
      <article class="iron-vault-character">
        ${this.sections.includes(CharacterSheetSection.INFO)
          ? this.renderCharacterInfo(charCtx)
          : null}
        ${this.sections.includes(CharacterSheetSection.STATS)
          ? this.renderStats(charCtx)
          : null}
        ${this.sections.includes(CharacterSheetSection.METERS)
          ? this.renderMeters(charCtx)
          : null}
        ${this.sections.includes(CharacterSheetSection.SPECIAL_TRACKS)
          ? this.renderSpecialTracks(charCtx)
          : null}
        ${this.sections.includes(CharacterSheetSection.IMPACTS)
          ? this.renderImpacts(charCtx, readOnly)
          : null}
        ${this.sections.includes(CharacterSheetSection.ASSETS)
          ? this.renderAssets(charCtx)
          : null}
      </article>
    `;
    render(tpl, this.containerEl);
  }

  renderCharacterInfo(charCtx: CharacterContext) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const charFieldUpdater = (
      lens:
        | Lens<ValidatedCharacter, string>
        | Lens<ValidatedCharacter, string | undefined>,
    ) => {
      return (e: Event) => {
        const target = e.target as HTMLInputElement;
        charCtx.updater(
          vaultProcess(this.plugin.app, this.sourcePath),
          (char) => lens.update(char, target.value),
        );
      };
    };
    const charNumFieldUpdater = (lens: Lens<ValidatedCharacter, number>) => {
      return (e: Event) => {
        const target = e.target as HTMLInputElement;
        charCtx.updater(
          vaultProcess(this.plugin.app, this.sourcePath),
          (char) => lens.update(char, +target.value),
        );
      };
    };
    const charBoolFieldUpdater = (
      lens: Lens<ValidatedCharacter, boolean | undefined>,
    ) => {
      return (e: Event) => {
        const target = e.target as HTMLInputElement;
        charCtx.updater(
          vaultProcess(this.plugin.app, this.sourcePath),
          (char) =>
            lens.update(
              char,
              target.value === "true"
                ? true
                : target.value === "false"
                  ? false
                  : undefined,
            ),
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
      ${this.plugin.characters.size > 1 &&
      this.plugin.localSettings.activeCharacter !== this.sourcePath
        ? html`<button
            type="button"
            class="set-active"
            @click=${async () => {
              await setActiveCharacter(this.plugin, this.sourcePath);
              this.render();
            }}
          >
            Make active character
          </button>`
        : this.plugin.characters.size > 1
          ? html`<span class="active-char">Active character</span>`
          : null}
      <select
        class="initiative"
        .value=${"" + (lens.initiative.get(raw) ?? "out-of-combat")}
        @change=${charBoolFieldUpdater(lens.initiative)}
      >
        <option value="true" ?selected=${lens.initiative.get(raw) === true}>
          ${this.initiativeValueLabel(lens, true)}
        </option>
        <option value="false" ?selected=${lens.initiative.get(raw) === false}>
          ${this.initiativeValueLabel(lens, false)}
        </option>
        <option
          value="out-of-combat"
          ?selected=${lens.initiative.get(raw) === undefined}
        >
          ${this.initiativeValueLabel(lens, undefined)}
        </option>
      </select>
      <dl>
        <dt>${this.plugin.settings.enableIronsworn ? "Alias" : "Callsign"}</dt>
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
        <dd
          class="description"
          data-replicated-value=${lens.description.get(raw) || ""}
        >
          <textarea
            placeholder="About me"
            onInput="this.parentNode.dataset.replicatedValue = this.value"
            .value=${lens.description.get(raw) || ""}
            @change=${charFieldUpdater(lens.description)}
          >
          </textarea>
        </dd>
        <dt>XP earned</dt>
        <dd class="xp-earned">
          ${Object.values(lens.special_tracks).reduce((acc, track) => {
            return acc + legacyTrackXpEarned(track.get(raw));
          }, 0)}
        </dd>
        <dt>XP spent</dt>
        <dd class="xp-spent">
          <input
            type="number"
            .value=${lens.xp_spent.get(raw) ?? ""}
            @change=${charNumFieldUpdater(lens.xp_spent)}
          />
        </dd>
      </dl>
    </section>`;
  }

  renderStats(charCtx: CharacterContext) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const statUpdater = (lens: Lens<ValidatedCharacter, number>) => {
      return (e: Event) => {
        const target = e.target as HTMLInputElement;
        charCtx.updater(
          vaultProcess(this.plugin.app, this.sourcePath),
          (char) => lens.update(char, +target.value),
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

  renderMeters(charCtx: CharacterContext) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const updateMeter = (
      lens: Lens<ValidatedCharacter, number>,
      delta: number,
    ) => {
      charCtx.updater(vaultProcess(this.plugin.app, this.sourcePath), (char) =>
        lens.update(char, lens.get(raw) + delta),
      );
    };
    const momOps = momentumOps(lens);
    const updateMomentum = (delta?: number) => {
      charCtx.updater(vaultProcess(this.plugin.app, this.sourcePath), (char) =>
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

  renderImpacts(charCtx: CharacterContext, readOnly: boolean) {
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
      charCtx.updater(vaultProcess(this.plugin.app, this.sourcePath), (char) =>
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

  renderSpecialTracks(charCtx: CharacterContext) {
    const lens = charCtx.lens;
    const raw = charCtx.character;
    const updateTrack = (
      track: Lens<ValidatedCharacter, ProgressTrack>,
      info: { steps?: number; ticks?: number },
    ) => {
      charCtx.updater(vaultProcess(this.plugin.app, this.sourcePath), (char) =>
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

  renderAssets(charCtx: CharacterContext) {
    const lens = charCtx.lens;
    const raw = charCtx.character;

    const updateAsset = (asset: Asset) => {
      charCtx.updater(vaultProcess(this.plugin.app, this.sourcePath), (char) =>
        addOrUpdateViaDataswornAsset(lens, this.plugin.datastore).update(
          char,
          asset,
        ),
      );
    };

    const removeAsset = (asset: { id: string }) => {
      charCtx.updater(vaultProcess(this.plugin.app, this.sourcePath), (char) =>
        lens.assets.update(
          char,
          lens.assets.get(char).filter((a) => a.id !== asset.id),
        ),
      );
    };

    const makeSortable = (el?: Element) => {
      if (el && Sortable.get(el as HTMLElement)) {
        Sortable.get(el as HTMLElement)!.destroy();
      }
      if (el) {
        Sortable.create(el as HTMLElement, {
          animation: 150,
          delay: 200,
          delayOnTouchOnly: true,
          onEnd: (evt) => {
            const assets = [...lens.assets.get(raw)];
            if (evt.oldIndex != null && evt.newIndex != null) {
              const a = assets[evt.oldIndex];
              assets[evt.oldIndex] = assets[evt.newIndex];
              assets[evt.newIndex] = a;
              charCtx.updater(
                vaultProcess(this.plugin.app, this.sourcePath),
                (char) => lens.assets.update(char, assets),
              );
            }
          },
        });
      }
    };

    return html`
      <section class="assets">
        <ul ${ref(makeSortable)}>
          ${repeat(
            lens.assets.get(raw),
            (asset) => asset.id,
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
        </ul>
        <button
          class="add-asset"
          type="button"
          @click=${() =>
            addAssetToCharacter(
              this.plugin,
              undefined,
              undefined,
              undefined,
              new CharacterActionContext(
                this.plugin.datastore,
                this.sourcePath,
                charCtx,
              ),
            )}
        >
          Add Asset
        </button>
      </section>
    `;
  }

  initiativeValueLabel(lens: CharacterLens, val: boolean | undefined) {
    const labels = [];
    if (val === true && lens.ruleset.ids.contains("classic")) {
      labels.push("Has initiative");
    }
    if (val === false && lens.ruleset.ids.contains("classic")) {
      labels.push("No initiative");
    }
    if (val === true && lens.ruleset.ids.contains("starforged")) {
      labels.push("In control");
    }
    if (val === false && lens.ruleset.ids.contains("starforged")) {
      labels.push("In a bad spot");
    }
    if (val == null) {
      labels.push("Out of combat");
    }
    return labels.join("/");
  }
}
