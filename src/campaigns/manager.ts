import IronVaultPlugin from "index";
import {
  Component,
  Notice,
  TAbstractFile,
  TFile,
  TFolder,
  Vault,
} from "obsidian";
import { CampaignFile } from "./entity";

export class CampaignManager extends Component {
  constructor(readonly plugin: IronVaultPlugin) {
    super();
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

  campaignForFile(file: TFile): CampaignFile | undefined {
    return this.campaignFolderAssignment().get(file.parent!);
  }
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
