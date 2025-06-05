import { childOfPath, parentFolderOf } from "@ironvault/utils/paths";
import Emittery, { UnsubscribeFunction } from "emittery";
import IronVaultPlugin from "index";
import { onlyValid } from "indexer/index-impl";
import { EmittingIndex } from "indexer/index-interface";
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
} from "obsidian";
import { EVENT_TYPES as LOCAL_SETTINGS_EVENT_TYPES } from "settings/local";
import { Either, Left, Right } from "utils/either";
import { CustomSuggestModal } from "utils/suggest";
import { z } from "zod";
import { CampaignDataContext } from "./context";
import { CampaignFile } from "./entity";

const logger = rootLogger.getLogger("campaign-manager");

export class OverlappingCampaignError extends Error {}

type CAMPAIGN_WATCHER_EVENT_TYPES = {
  update: {
    campaignPath: string;
    campaignRoot: string;
    campaign: CampaignFile | null;
  };
};

export class CampaignWatcher extends Component {
  #lastSeen: Map<string, CampaignFile> = new Map();

  #events: Emittery<CAMPAIGN_WATCHER_EVENT_TYPES> = new Emittery();

  getAssignment(
    sourcePath: string,
  ): Either<OverlappingCampaignError, CampaignFile | null> {
    let foundAssignment: CampaignFile | null = null;
    for (const [thisPath, thisCampaign] of this.#lastSeen.entries()) {
      const thisRoot = parentFolderOf(thisPath);
      if (childOfPath(thisRoot, sourcePath)) {
        if (foundAssignment != null) {
          const msg = `Path '%s' has two potential campaign roots: '%s' and '%s'. It is not valid for two campaigns to have overlapping roots.`;
          logger.warn(msg);
          return Left.create(new OverlappingCampaignError(msg));
        } else {
          foundAssignment = thisCampaign;
        }
      }
    }
    return Right.create(foundAssignment);
  }

  /** Get the campaign last seen by the watcher at this path. */
  get(campaignPath: string): CampaignFile | undefined {
    return this.#lastSeen.get(campaignPath);
  }

  /** Sets a watch for the campaign root of a file to change. */
  watch(
    watchPath: string,
    update: () => unknown,
  ): { campaign: CampaignFile | null; unsubscribe: UnsubscribeFunction } {
    // We ignore overlapping campaign errors for watch.
    const originalAssignment = this.getAssignment(watchPath).getOrElse(null);
    const unsubscribe = this.#events.on(
      "update",
      ({ campaignRoot, campaign }) => {
        // If any parent of this has changed, check if the new assignment would differ from the old
        if (
          childOfPath(campaignRoot, watchPath) &&
          originalAssignment != campaign
        ) {
          logger.debug(
            "path=%s may have changed assignment. (root=%s old=%o new=%o)",
            watchPath,
            campaignRoot,
            originalAssignment,
            campaign,
          );
          unsubscribe();
          update();
        }
      },
    );

    return { campaign: originalAssignment, unsubscribe };
  }

  constructor(
    readonly campaigns: EmittingIndex<CampaignFile, z.ZodError>,
    readonly areSame: (left: CampaignFile, right: CampaignFile) => boolean,
  ) {
    super();
  }

  onload(): void {
    super.onload();
    this.registerEvent(
      this.campaigns.on("changed", (path) => {
        const oldValue = this.#lastSeen.get(path);
        const newValue = this.campaigns.get(path)?.getOrElse(undefined);
        logger.debug(
          "path=%s: detected change old=%o new=%o",
          path,
          oldValue,
          newValue,
        );
        if (newValue != null) {
          if (oldValue == null || !this.areSame(oldValue, newValue)) {
            logger.debug("path=%s: determined update", path);
            // We have a new value for this path
            this.#lastSeen.set(path, newValue);

            this.#events.emit("update", {
              campaignPath: path,
              campaignRoot: parentFolderOf(path),
              campaign: newValue,
            });
          }
        } else if (oldValue != null) {
          logger.debug("path=%s: determined remove", path);
          // Removing the new value
          this.#lastSeen.delete(path);
          this.#events.emit("update", {
            campaignPath: path,
            campaignRoot: parentFolderOf(path),
            campaign: null,
          });
        }
      }),
    );
    this.registerEvent(
      this.campaigns.on("renamed", (oldPath, newPath) => {
        const original = this.#lastSeen.get(oldPath);
        if (original == null) {
          logger.warn("Missing value for %s -> %s", oldPath, newPath);
        } else {
          this.#lastSeen.delete(oldPath);
          this.#lastSeen.set(newPath, original);

          // If the campaign file was just renamed in the same folder, we don't need to do
          // anything else-- no state will change in the app.
          // However, if the campaign file was moved to a different folder, we need to emit
          // an update event to allow the app to reindex.
          if (parentFolderOf(oldPath) != parentFolderOf(newPath)) {
            this.#events.emit("update", {
              campaignPath: newPath,
              campaignRoot: parentFolderOf(newPath),
              campaign: original,
            });
            this.#events.emit("update", {
              campaignPath: oldPath,
              campaignRoot: parentFolderOf(oldPath),
              campaign: null,
            });
          }
        }
      }),
    );
  }

  on<K extends keyof CAMPAIGN_WATCHER_EVENT_TYPES>(
    event: K,
    listener: (params: CAMPAIGN_WATCHER_EVENT_TYPES[K]) => void,
  ) {
    return this.#events.on(event, listener);
  }

  off<K extends keyof CAMPAIGN_WATCHER_EVENT_TYPES>(
    event: K,
    listener: (params: CAMPAIGN_WATCHER_EVENT_TYPES[K]) => void,
  ) {
    return this.#events.off(event, listener);
  }
}

export function campaignsEqual(
  left: CampaignFile,
  right: CampaignFile,
): boolean {
  return left.file == right.file && left.playset.equals(right.playset);
}

export class CampaignManager extends Component {
  #events: Events = new Events();

  /** The last open view file */
  #lastActive:
    | { viewFile: TFile; campaign: CampaignFile | undefined }
    | undefined = undefined;

  /** Cached campaign contexts.
   * This is a weak map so that when campaign objects are recreated, the context can be
   * garbage collected.
   */
  #campaignDataContexts: WeakMap<CampaignFile, CampaignDataContext> =
    new WeakMap();

  readonly watcher: CampaignWatcher;

  constructor(readonly plugin: IronVaultPlugin) {
    super();
    this.watcher = this.addChild(
      new CampaignWatcher(this.plugin.campaigns, campaignsEqual),
    );
  }

  lastActiveCampaign(): CampaignFile | undefined {
    return this.#lastActive?.campaign;
  }

  lastActiveCampaignContext(): CampaignDataContext | undefined {
    const campaign = this.lastActiveCampaign();
    return campaign && this.campaignContextFor(campaign);
  }

  onload(): void {
    this.registerEvent(
      this.plugin.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf?.view instanceof MarkdownView && leaf.view.file) {
          this.setActiveCampaignFromFile(leaf.view.file);
        }
      }),
    );

    this.plugin.app.workspace.onLayoutReady(() => {
      const file = this.plugin.app.workspace.getActiveFile();
      logger.debug("Layout ready, active file: %o", file);
      if (file) {
        this.setActiveCampaignFromFile(
          file,
          true, // force update
        );
      }
    });

    this.register(
      this.plugin.localSettings.on("change", (change) => {
        if (change.campaignFile === this.#lastActive?.campaign?.file) {
          this.trigger("active-campaign-settings-changed", change);
        }
      }),
    );

    this.register(
      this.watcher.on("update", ({ campaign, campaignRoot }) => {
        this.updateActiveCampaign();
        if (campaign == null) {
          // The campaign is no longer at this path, so remove from index.
          this.plugin.datastore.unregisterCampaignContentPathByRoot(
            campaignRoot,
          );
        } else {
          // We have a campaign at this path. Get it's campaign content folder and add it to the
          // list of monitored paths.
          const campaignContentFolderName =
            campaign.customContentFolder ??
            this.plugin.settings.defaultCampaignContentFolder;
          this.plugin.datastore.registerCampaignContentPath(
            `${campaignRoot}/${campaignContentFolderName}`,
          );
        }
      }),
    );

    this.registerEvent(
      this.plugin.app.metadataCache.on("iron-vault:index-changed", () => {
        // TODO: this doesn't really belong here, but it's just temporary
        // until we have a better way to handle reloading characters.
        logger.info("Index changed, marking reloading characters.");
        const knownCharacters = [...this.plugin.characters.keys()];
        for (const characterPath of knownCharacters) {
          this.plugin.indexManager.markDirty(characterPath);
        }
      }),
    );
  }

  private updateActiveCampaign() {
    if (this.#lastActive?.viewFile) {
      this.setActiveCampaignFromFile(this.#lastActive.viewFile, true);
    }
  }

  private setActiveCampaignFromFile(viewFile: TFile, force: boolean = false) {
    // If the file is the same, nothing to do
    if (!force && this.#lastActive?.viewFile == viewFile) return;

    const lastCampaign = this.#lastActive?.campaign;
    const viewCampaign = this.campaignForFile(viewFile);

    this.#lastActive = {
      viewFile,
      campaign: viewCampaign,
    };

    if (lastCampaign != viewCampaign) {
      logger.debug(
        "Active campaign changed from %s to %s",
        lastCampaign?.file.path,
        viewCampaign?.file.path,
      );
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

  awaitCampaignAvailability(
    path: string,
    timeout: number = 1000,
  ): Promise<CampaignFile> {
    logger.debug("Waiting for campaign at %s", path);
    const existing = this.watcher.get(path);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      let timeoutId: number | null = null;
      const unsub = this.watcher.on("update", ({ campaign, campaignPath }) => {
        logger.debug("watcher updated %s %o", campaignPath, campaign);
        if (campaignPath == path && campaign != null) {
          logger.debug("Campaign has been indexed.");
          unsub();
          if (timeoutId != null) clearTimeout(timeoutId);
          resolve(campaign);
        }
      });
      timeoutId = window.setTimeout(() => {
        logger.debug(
          "Wait for campaign at %s timed out after %d",
          path,
          timeout,
        );
        unsub();
        reject(new Error("Timed out waiting for campaign"));
      }, timeout);
    });
  }

  campaignForFile(file: TAbstractFile): CampaignFile | undefined {
    return this.campaignForPath(file.path);
  }

  campaignForPath(path: string): CampaignFile | undefined {
    const assignment = this.watcher.getAssignment(path);
    if (assignment.isLeft()) {
      const error = assignment.error;
      new Notice(error.message, 0);
      throw error;
    }
    return assignment.value ?? undefined;
  }

  watchForReindex(path: string): CampaignFile | null {
    return this.watcher.watch(path, () =>
      this.plugin.indexManager.markDirty(path),
    ).campaign;
  }

  /** Gets the campaign context for a given campaign object.
   *
   * Note that the campaign object is recreated whenever the campaign is reindexed (b/c
   * it changes or is moved). This means that the context is not stable across reindexing,
   * but it DOES mean that CampaignDataContext does not need to worry about changes to the
   * properties of the object (such as the campaign content path).
   */
  campaignContextFor(campaign: CampaignFile): CampaignDataContext {
    let context = this.#campaignDataContexts.get(campaign);
    if (!context) {
      this.#campaignDataContexts.set(
        campaign,
        (context = new CampaignDataContext(
          this.plugin, // this is for the settings/for dice roller
          this.plugin, // this is the tracked entities
          this.plugin.datastore.indexer,
          campaign,
          (path) => this.campaignForPath(path)?.file === campaign.file,
        )),
      );
    }
    return context;
  }

  on<K extends keyof EVENT_TYPES>(
    name: K,
    callback: (params: EVENT_TYPES[K]) => unknown,
    ctx?: unknown,
  ): EventRef {
    return this.#events.on(
      name,
      callback as (...data: unknown[]) => unknown,
      ctx,
    );
  }

  off(name: string, callback: (...data: unknown[]) => unknown): void {
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
): Promise<CampaignDataContext> {
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
