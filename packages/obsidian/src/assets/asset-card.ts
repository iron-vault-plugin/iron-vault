import {
  Asset,
  AssetAbility,
  AssetAbilityControlField,
  AssetConditionMeter,
  AssetControlField,
  AssetOptionField,
  DictKey,
} from "@datasworn/core/dist/Datasworn";
import { TemplateResult, html, nothing } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { range } from "lit-html/directives/range.js";

import { Clock } from "clocks/clock";
import { clockWidget } from "clocks/ui/clock-widget";
import { IDataContext } from "datastore/data-context";
import { produce } from "immer";
import IronVaultPlugin from "index";
import { repeat } from "lit-html/directives/repeat.js";
import { rootLogger } from "logger";
import { md } from "utils/ui/directives";
import { integratedAssetReader } from "../characters/assets";
import { IronVaultSheetAssetSchema } from "../characters/lens";

const logger = rootLogger.getLogger("asset-card");

export function makeDefaultSheetAsset(asset: Asset) {
  return {
    id: asset._id,
    abilities: asset.abilities.map((a) => a.enabled),
    options: Object.fromEntries(
      [...Object.entries(asset.options ?? {})].map(([key, opt]) => {
        return [key, opt.value];
      }),
    ),
    controls: Object.fromEntries(
      [...Object.entries(asset.controls ?? {})].map(([key, control]) => {
        return [key, control.value];
      }),
    ),
  };
}

export default function renderAssetCard(
  plugin: IronVaultPlugin,
  dataContext: IDataContext,
  sheetAsset: IronVaultSheetAssetSchema,
  updateAsset?: (asset: Asset) => void,
) {
  const assetRes = integratedAssetReader(dataContext).get(sheetAsset);

  if (assetRes.isErr) {
    return html`<article class="iron-vault-asset-card">Error: ${assetRes.error.message}</a>`;
  }

  const asset = assetRes.value;

  return html`
    <article class="iron-vault-asset-card">
      <header>
        <dl>
          <dt>Type</dt>
          <dd class="category">${asset.category}</dd>
          <dt>Name</dt>
          <dd class="name">${asset.canonical_name ?? asset.name}</dd>
          ${asset.requirement &&
          html`
            <dt>Requirement</dt>
            <dd class="requirement">${md(plugin, asset.requirement)}</dd>
          `}
          ${asset.icon && html`<img src=${asset.icon} />`}
          ${asset.options &&
          html`
            <dt>Options</dt>
            <dd class="options">
              <ul>
                ${map(Object.entries(asset.options), ([name, opt]) => {
                  return html`
                    <li>
                      <dl>
                        <dt class="option-name">${name}</dt>
                        <dd>
                          <label
                            ><span>${opt.label}</span> ${renderOption(
                              asset,
                              name,
                              opt,
                              updateAsset,
                            )}</label
                          >
                        </dd>
                      </dl>
                    </li>
                  `;
                })}
              </ul>
            </dd>
          `}
        </dl>
      </header>
      <section>
        <ul class="abilities">
          ${repeat(
            Object.values(asset.abilities),
            (ability) => ability._id,
            (ability, i) =>
              renderAssetAbility(asset, plugin, ability, i, updateAsset),
          )}
        </ul>
      </section>
      ${asset.controls &&
      html`<section class="controls-section">
        ${renderControls(asset, asset.controls, updateAsset)}
      </section>`}
      <footer>${asset._source.title}</footer>
    </article>
  `;
}

function renderOption(
  asset: Asset,
  key: DictKey,
  option: AssetOptionField,
  updateAsset?: (asset: Asset) => void,
) {
  const updateOption = (e: Event) => {
    if (!updateAsset) {
      return;
    }
    const value = (e.target as HTMLInputElement).value;
    updateAsset(
      produce(asset, (draft) => {
        if (!draft.options) {
          draft.options = {};
        }
        draft.options[key].value = value;
      }),
    );
  };
  switch (option.field_type) {
    case "text": {
      return html`<input
        type="text"
        ?disabled=${!updateAsset}
        placeholder=${option.label}
        .value=${option.value}
        @change=${updateOption}
      />`;
    }
    case "select_enhancement": {
      return html`
        <select
          ?disabled="${!updateAsset}"
          .value=${option.value}
          @change=${updateOption}
        >
          ${map(Object.keys(option.choices), (key) => {
            return html`
              <option ?selected=${option.value === key} value=${key}>
                ${key}
              </option>
            `;
          })}
        </select>
      `;
    }
    case "select_value": {
      return html`
        <select
          ?disabled=${!updateAsset}
          .value=${option.value}
          @change=${updateOption}
        >
          ${map(Object.keys(option.choices), (key) => {
            return html`
              <option ?selected=${option.value === key} value=${key}>
                ${key}
              </option>
            `;
          })}
        </select>
      `;
    }
  }
}

function renderAssetAbility(
  asset: Asset,
  plugin: IronVaultPlugin,
  ability: AssetAbility,
  i: number,
  updateAsset?: (asset: Asset) => void,
) {
  const toggleAbility = () => {
    if (!updateAsset) {
      return;
    }
    updateAsset(
      produce(asset, (draft) => {
        draft.abilities[i].enabled = !draft.abilities[i].enabled;
      }),
    );
  };
  const updateControlField = (key: string) =>
    updateAsset &&
    ((control: AssetAbilityControlField) =>
      updateAsset(
        produce(asset, (draft) => {
          draft.abilities[i].controls![key] = control;
        }),
      ));
  return html`<li>
    <label>
      <input
        type="checkbox"
        ?disabled=${!updateAsset}
        ?checked=${ability.enabled}
        @click=${toggleAbility}
      />
      <span>${md(plugin, ability.text)}</span>
    </label>
    ${ability.controls
      ? html`<ul class="controls">
          ${repeat(
            Object.entries(ability.controls),
            ([key]) => key,
            ([key, control]) => {
              return html`<li>
                <dl>
                  <dt>${key}</dt>
                  <dd class="control">
                    ${renderControl(key, control, updateControlField(key))}
                  </dd>
                </dl>
              </li>`;
            },
          )}
        </ul>`
      : null}
  </li>`;
}

function renderControls<T extends Asset | AssetConditionMeter>(
  parent: T,
  controls: NonNullable<T["controls"]>,
  updateParent?: (parent: T) => void,
): TemplateResult {
  const updateControlField = (key: string) =>
    updateParent &&
    ((control: AssetControlField) =>
      updateParent(
        produce(parent, (draft) => {
          draft.controls![key] = control;
        }),
      ));
  return html`
    <ul class="controls">
      ${repeat(
        Object.entries(controls),
        ([key]) => key,
        ([key, control]) => {
          return html`
            <li>
              <dl>
                <dt>${key}</dt>
                <dd class="control">
                  ${renderControl(key, control, updateControlField(key))}
                </dd>
              </dl>
            </li>
          `;
        },
      )}
    </ul>
  `;
}

function renderControl<C extends AssetControlField | AssetAbilityControlField>(
  key: string,
  control: C,
  updateControl?: (control: C) => void,
) {
  const updateControlValue = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    if (!updateControl) return;
    updateControl(
      produce(control, (draft) => {
        draft.value = value;
      }),
    );
  };
  const updateControlValueNumeric = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    if (!updateControl) return;
    updateControl(
      produce(control, (draft) => {
        draft.value = +value;
      }),
    );
  };
  const toggleControl = () => {
    if (!updateControl) {
      return;
    }
    updateControl(
      produce(control, (draft) => {
        draft.value = !draft.value;
      }),
    );
  };
  const updateClockValue = (newProgress: number) => {
    if (!updateControl) return;
    updateControl(
      produce(control, (draft) => {
        draft.value = newProgress;
      }),
    );
  };

  switch (control.field_type) {
    case "condition_meter": {
      return html`<form
        class="condition-meter"
        @submit=${(ev: Event) => ev.preventDefault()}
      >
        ${control.controls &&
        renderControls(
          control,
          control.controls,
          // At this point we know this must be an updater for a condition meter
          updateControl as (control: AssetConditionMeter) => void,
        )}
        <ul class="meter">
          <li><span>${control.label}</span></li>
          ${repeat(
            range(control.max + 1),
            (i) => i,
            (i) =>
              html`<li>
                <label
                  ><span>${i}</span
                  ><input
                    type="radio"
                    ?checked=${control.value === i}
                    ?disabled=${!updateControl}
                    .value=${i}
                    value=${i}
                    name=${control.label}
                    @click=${updateControlValueNumeric}
                  />
                </label>
              </li> `,
          )}
        </ul>
      </form>`;
    }
    case "card_flip": {
      return html`<label class="checkbox"
        ><span>${control.label}</span
        ><input
          type="checkbox"
          ?disabled=${!updateControl}
          ?checked=${control.value}
          @click=${toggleControl}
      /></label>`;
    }
    case "checkbox": {
      return html`<label class="checkbox"
        ><span>${control.label}</span>
        <input
          type="checkbox"
          ?disabled=${!updateControl}
          ?checked=${control.value}
          @click=${toggleControl}
        />
      </label>`;
    }
    case "select_enhancement": {
      return html`<label class="select-enhancement">
        <span>${control.label}</span>
        <select
          ?disabled=${!updateControl}
          .value=${control.value}
          @click=${updateControlValue}
        >
          <option ?selected=${control.value == null}></option>
          ${map(Object.entries(control.choices), ([key, choice]) =>
            choice.choice_type === "choice_group"
              ? html`<optgroup label=${choice.name}>
                  ${map(
                    Object.entries(choice.choices),
                    ([key, choice]) =>
                      html`<option
                        ?selected=${control.value === key}
                        value=${key}
                      >
                        ${choice.label}
                      </option>`,
                  )}
                </optgroup>`
              : html`<option ?selected=${control.value === key} value=${key}>
                  ${choice.label}
                </option>`,
          )}
        </select>
      </label>`;
    }

    case "clock": {
      return clockWidget(
        Clock.create({
          active: true,
          name: control.label,
          progress: control.value,
          segments: control.max,
        }).unwrap(),
        updateClockValue,
      );
    }
    case "counter": {
      return html`<input
        type="number"
        min="${control.min}"
        max="${control.max ?? nothing}"
        .value=${control.value}
        ?disabled=${!updateControl}
        @change=${updateControlValueNumeric}
      />`;
    }

    case "text": {
      return html`<input
        type="text"
        ?disabled=${!updateControl}
        placeholder=${control.label}
        .value=${control.value}
        @change=${updateControlValue}
      />`;
    }
    default:
      logger.warn(
        "Unsupported asset control: %s",
        (control as { field_type: string }).field_type,
      );
      return html``;
  }
}
