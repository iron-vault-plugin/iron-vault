import { TemplateResult, html } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { range } from "lit-html/directives/range.js";
import {
  AssetAbility,
  AssetControlField,
  AssetOptionField,
} from "@datasworn/core/dist/Datasworn";

import { IronVaultSheetAssetSchema } from "./lens";
import IronVaultPlugin from "index";
import { md } from "utils/ui/directives";

export default function renderAssetCard(
  plugin: IronVaultPlugin,
  sheetAsset: IronVaultSheetAssetSchema,
  readOnly: boolean = false,
) {
  const asset = plugin.datastore.assets.get(sheetAsset.id);
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
                              opt,
                              readOnly,
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
          ${map(Object.values(asset.abilities), (ability) =>
            renderAssetAbility(plugin, ability, readOnly),
          )}
        </ul>
      </section>
      ${asset.controls &&
      html`<section class="controls-section">
        ${renderControls(plugin, asset.controls, readOnly)}
      </section>`}
    </article>
  `;
}

function renderOption(option: AssetOptionField, readOnly: boolean) {
  switch (option.field_type) {
    case "text": {
      return html`<input
        type="text"
        ?disabled=${readOnly}
        placeholder=${option.label}
        .value=${option.value}
      />`;
    }
    case "select_enhancement": {
      return html`
        <select ?disabled="${readOnly}" .value=${option.value}>
          ${map(Object.keys(option.choices), (key) => {
            return html` <option value=${key}>${key}</option> `;
          })}
        </select>
      `;
    }
    case "select_value": {
      return html`
        <select ?disabled=${readOnly} .value=${option.value}>
          ${map(Object.keys(option.choices), (key) => {
            return html` <option value=${key}>${key}</option> `;
          })}
        </select>
      `;
    }
  }
}

function renderAssetAbility(
  plugin: IronVaultPlugin,
  ability: AssetAbility,
  readOnly: boolean,
) {
  return html`<li>
    <label>
      <input
        type="checkbox"
        ?disabled=${readOnly}
        ?checked=${ability.enabled}
      />
      <span>${md(plugin, ability.text)}</span>
    </label>
  </li>`;
}

function renderControls(
  plugin: IronVaultPlugin,
  controls: Record<string, AssetControlField>,
  readOnly: boolean,
): TemplateResult {
  return html`
    <ul class="controls">
      ${map(Object.entries(controls), ([key, control]) => {
        return html`
          <li>
            <dl>
              <dt>${key}</dt>
              <dd class="control">
                ${renderControl(plugin, control, readOnly)}
              </dd>
            </dl>
          </li>
        `;
      })}
    </ul>
  `;
}

function renderControl(
  plugin: IronVaultPlugin,
  control: AssetControlField,
  readOnly: boolean,
) {
  switch (control.field_type) {
    case "condition_meter": {
      return html`<div class="condition-meter">
        ${control.controls &&
        renderControls(plugin, control.controls, readOnly)}
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
                    ?checked=${control.value}
                    ?disabled=${readOnly}
                    name=${control.label}
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
        ><input type="checkbox" ?disabled=${readOnly} ?checked=${control.value}
      /></label>`;
    }
    case "checkbox": {
      return html`<label class="checkbox"
        ><input
          type="checkbox"
          ?disabled=${readOnly}
          ?checked=${control.value}
        />
        <span>${control.label}</span>
      </label>`;
    }
    case "select_enhancement": {
      return html`<label class="select-enhancement">
        <span>${control.label}</span>
        <select ?disabled=${readOnly} .value=${control.value}>
          ${map(
            Object.keys(control.choices),
            (key) => html`<option value=${key}>${key}</option>`,
          )}
        </select>
      </label>`;
    }
  }
  return null;
}
