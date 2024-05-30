import {
  Asset,
  AssetAbility,
  AssetConditionMeter,
  AssetControlField,
  AssetOptionField,
  DictKey,
} from "@datasworn/core/dist/Datasworn";
import { TemplateResult, html } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { range } from "lit-html/directives/range.js";

import { produce } from "immer";
import IronVaultPlugin from "index";
import { md } from "utils/ui/directives";
import { integratedAssetLens } from "./assets";
import { IronVaultSheetAssetSchema } from "./lens";

export default function renderAssetCard(
  plugin: IronVaultPlugin,
  sheetAsset: IronVaultSheetAssetSchema,
  updateAsset?: (asset: Asset) => void,
) {
  const asset = integratedAssetLens(plugin.datastore).get(sheetAsset);
  if (!asset) {
    return;
  }
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
            <dd class="requirement">${asset.requirement}</dd>
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
          ${map(Object.values(asset.abilities), (ability, i) =>
            renderAssetAbility(asset, plugin, ability, i, updateAsset),
          )}
        </ul>
      </section>
      ${asset.controls &&
      html`<section class="controls-section">
        ${renderControls(asset, asset.controls, updateAsset)}
      </section>`}
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
            return html` <option value=${key}>${key}</option> `;
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
            return html` <option value=${key}>${key}</option> `;
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
      ${map(Object.entries(controls), ([key, control]) => {
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
      })}
    </ul>
  `;
}

function renderControl(
  key: string,
  control: AssetControlField,
  updateControl?: (asset: AssetControlField) => void,
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

  switch (control.field_type) {
    case "condition_meter": {
      return html`<div class="condition-meter">
        ${control.controls &&
        renderControls(control, control.controls, updateControl)}
        <ul class="meter">
          <li><span>${control.label}</span></li>
          ${map(
            range(control.max + 1),
            (i) =>
              html`<li>
                <label
                  ><span>${i}</span
                  ><input
                    type="radio"
                    ?checked=${control.value === i}
                    ?disabled=${!updateControl}
                    .value=${i}
                    name=${control.label}
                    @click=${updateControlValueNumeric}
                  />
                </label>
              </li> `,
          )}
        </ul>
      </div>`;
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
          ${map(
            Object.keys(control.choices),
            (key) => html`<option value=${key}>${key}</option>`,
          )}
        </select>
      </label>`;
    }
  }
}
