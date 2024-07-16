import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import { rootLogger } from "logger";
import {
  Component,
  EventRef,
  Events,
  MarkdownFileInfo,
  MarkdownView,
  Notice,
  TAbstractFile,
  TFile,
  TFolder,
  Vault,
} from "obsidian";
import { EVENT_TYPES as LOCAL_SETTINGS_EVENT_TYPES } from "settings/local";
import { CustomSuggestModal } from "utils/suggest";
import { CampaignTrackedEntities } from "./context";
import { CampaignFile } from "./entity";

const logger = rootLogger.getLogger("campaign-manager");

export class CampaignManager extends Component {
  #events: Events = new Events();

  #lastActiveCampaignFile: TFile | undefined = undefined;

  constructor(readonly plugin: IronVaultPlugin) {
    super();
  }

  lastActiveCampaign(): CampaignFile | undefined {
    return this.#lastActiveCampaignFile != null
      ? this.plugin.campaigns
          .get(this.#lastActiveCampaignFile.path)
          ?.expect(
            `Campaign at ${this.#lastActiveCampaignFile.path} should be valid.`,
          )
      : undefined;
  }

  onload(): void {
    this.registerEvent(
      this.plugin.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf?.view instanceof MarkdownView && leaf.view.file) {
          this.setActiveCampaignFromFile(leaf.view.file);
        }
      }),
    );

    this.register(
      this.plugin.localSettings.on("change", (change) => {
        if (change.campaignFile === this.#lastActiveCampaignFile) {
          this.trigger("active-campaign-settings-changed", change);
        }
      }),
    );
  }

  private setActiveCampaignFromFile(file: TFile) {
    const viewCampaign = this.campaignForFile(file);
    const lastActiveCampaignFile = this.#lastActiveCampaignFile;

    if (viewCampaign?.file !== lastActiveCampaignFile) {
      logger.trace(
        "Active campaign changed from %s to %s",
        lastActiveCampaignFile?.path,
        viewCampaign?.file.path,
      );
      this.#lastActiveCampaignFile = viewCampaign?.file;
      this.trigger("active-campaign-changed", {
        newCampaign: viewCampaign,
      });
    }
  }

  resetActiveCampaign(): void {
    const activeEditorFile = this.plugin.app.workspace.activeEditor?.file;
    if (activeEditorFile) {
      this.setActiveCampaignFromFile(activeEditorFile);
    }
  }

  campaignFolderAssignment(): ReadonlyMap<TFolder, CampaignFile> {
    const assignments = new Map<TFolder, CampaignFile>();
    for (const entry of this.plugin.campaigns.values()) {
      if (entry.isRight()) {
        const campaign = entry.value;
        const root = campaign.file.parent!;
        Vault.recurseChildren(root, (file) => {
          if (file instanceof TFolder) {
            // Note: we don't do this when indexing because that would make one index entry possibly
            //   contingent on another file / the order they are indexed. This would make it hard to
            //   know what to reindex.
            // That said, if it becomes an issue, this can be cached if tracked entity indexes were
            //    versioned maps.
            const existing = assignments.get(file);
            if (existing) {
              const msg = `Campaign at '${campaign.file.path}' conflicts with '${existing.file.path}'. One cannot be in a parent folder of another.`;
              new Notice(msg, 0);
              throw new Error(msg);
            }
            assignments.set(file, campaign);
          }
        });
      }
    }
    return assignments;
  }

  campaignForFile(file: TAbstractFile): CampaignFile | undefined {
    const folder = file instanceof TFolder ? file : file.parent!;
    return this.campaignFolderAssignment().get(folder);
  }

  campaignForPath(path: string): CampaignFile | undefined {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (file == null) return undefined;
    return this.campaignForFile(file);
  }

  campaignContextFor(campaign: CampaignFile): CampaignTrackedEntities {
    return new CampaignTrackedEntities(
      this.plugin,
      campaign,
      // TODO(cwegrzyn): need to confirm that file equality comparison is safe
      (path) => this.campaignForPath(path)?.file === campaign.file,
    );
  }

  on<K extends keyof EVENT_TYPES>(
    name: K,
    callback: (params: EVENT_TYPES[K]) => unknown,
    ctx?: unknown,
  ): EventRef {
    return this.#events.on(name, callback, ctx);
  }

  off(name: string, callback: (...data: never[]) => unknown): void {
    this.#events.off(name, callback);
  }

  offref(ref: EventRef): void {
    this.#events.offref(ref);
  }

  private trigger<K extends keyof EVENT_TYPES>(
    name: K,
    data: EVENT_TYPES[K],
  ): void {
    this.#events.trigger(name, data);
  }
}

export type EVENT_TYPES = {
  "active-campaign-changed": {
    newCampaign: CampaignFile | undefined;
  };
  "active-campaign-settings-changed": LOCAL_SETTINGS_EVENT_TYPES["change"];
};

export async function determineCampaignContext(
  plugin: IronVaultPlugin,
  view?: MarkdownView | MarkdownFileInfo,
): Promise<CampaignTrackedEntities> {
  logger.trace("Determining campaign context for", view);
  const file = view?.file;
  let campaign = file && plugin.campaignManager.campaignForFile(file);
  if (!campaign) {
    campaign = await CustomSuggestModal.select(
      plugin.app,
      [...onlyValid(plugin.campaigns).values()],
      (campaign) => campaign.name,
      undefined,
      "No active campaign. Select a campaign...",
    );
  }
  return plugin.campaignManager.campaignContextFor(campaign);
}

/** Checks if the first file is a parent of the second. */
export function parentOf(
  potentialParent: TFolder,
  potentialChild: TAbstractFile,
): boolean {
  for (const parent of iterateParents(potentialChild)) {
    if (parent.path == potentialParent.path) return true;
  }
  return false;
}

export function* iterateParents(file: TAbstractFile) {
  let current = file.parent;
  while (current != null) {
    yield current;
    current = current.parent;
  }
}
