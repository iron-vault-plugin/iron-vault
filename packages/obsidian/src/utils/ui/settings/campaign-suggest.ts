import { CampaignFile } from "campaigns/entity";
import { StandardIndex } from "datastore/data-indexer";
import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import { DropdownComponent, Setting, ValueComponent } from "obsidian";

export class NoCamapaignError extends Error {}

export class CampaignSelectComponent extends ValueComponent<CampaignFile> {
  dropdown: DropdownComponent;
  #changeCallback?: (value: CampaignFile) => unknown;

  static addToSetting(
    setting: Setting,
    plugin: IronVaultPlugin,
    callback: (select: CampaignSelectComponent) => unknown,
  ): Setting {
    const component = new CampaignSelectComponent(setting.controlEl, plugin);
    setting.components.push(component);
    callback(component);
    return setting;
  }

  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
  ) {
    super();

    const availCampaigns = [...this.availableCampaigns().entries()];
    const campaigns: [string, string][] = availCampaigns.map(
      ([key, campaign]) => [key, campaign.name],
    );
    if (campaigns.length == 0) {
      throw new NoCamapaignError("No campaigns available.");
    }
    const campaignPath =
      this.plugin.campaignManager.lastActiveCampaign()?.file.path ??
      availCampaigns[0][0];

    this.dropdown = new DropdownComponent(containerEl)
      .addOptions(Object.fromEntries(campaigns))
      .setValue(campaignPath)
      .onChange(
        () => this.#changeCallback && this.#changeCallback(this.getValue()),
      );
  }

  availableCampaigns(): StandardIndex<CampaignFile> {
    return onlyValid(this.plugin.campaigns);
  }

  getValue(): CampaignFile {
    const value = this.dropdown.getValue();
    const campaign = this.availableCampaigns().get(value);
    if (!campaign) {
      throw new Error(`Found unexpected campaign path '${value}'`);
    }
    return campaign;
  }

  setValue(value: CampaignFile): this {
    this.dropdown.setValue(value.file.path);
    return this;
  }

  onChange(callback: (value: CampaignFile) => unknown): this {
    this.#changeCallback = callback;
    return this;
  }

  onChanged(): void {
    if (this.#changeCallback) this.#changeCallback(this.getValue());
  }
}
