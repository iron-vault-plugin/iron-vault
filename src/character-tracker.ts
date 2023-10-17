import {
  CharacterMetadata,
  CharacterMetadataFactory,
  CharacterWrapper,
  IronswornCharacterMetadata,
} from "character";
import {
  Component,
  TFile,
  getAllTags,
  type App,
  type CachedMetadata,
  type FileManager,
  type FrontMatterCache,
  type MetadataCache,
  type Vault,
} from "obsidian";

function isCharacterFile(
  md: CachedMetadata,
): md is CachedMetadata & { frontmatter: FrontMatterCache } {
  const tags = md != null ? getAllTags(md) ?? [] : [];
  if (tags.contains("#character")) {
    return true;
  } else {
    return false;
  }
}

export class CharacterTracker extends Component {
  metadataCache: MetadataCache;
  vault: Vault;
  fileManager: FileManager;

  /** Map file paths to metadata. */
  index: Map<string, CharacterWrapper>;

  constructor(app: App) {
    super();

    this.metadataCache = app.metadataCache;
    this.vault = app.vault;
    this.index = new Map();
    this.fileManager = app.fileManager;
  }

  public initialize(): void {
    this.registerEvent(
      this.metadataCache.on("changed", (file, data, cache) => {
        // console.log("changed: ", file);
        this.indexFile(file, cache);
      }),
    );

    this.registerEvent(
      this.metadataCache.on("deleted", (file) => {
        // TODO: might want to check values in prevCache
        const indexKey = file.path;
        if (this.index.has(indexKey)) {
          console.log("indexed file %s deleted. removing from index", indexKey);
          this.index.delete(indexKey);
        }
      }),
    );

    for (const file of this.vault.getMarkdownFiles()) {
      const cache = this.metadataCache.getFileCache(file);
      if (cache != null) {
        this.indexFile(file, cache);
      } else {
        console.log("no cache for ", file.path);
      }
    }
  }

  public async updateCharacter<T extends CharacterMetadata>(
    path: string,
    kls: CharacterMetadataFactory<T>,
    updater: (character: InstanceType<typeof kls>) => void,
  ): Promise<void> {
    const wrapper = this.index.get(path);
    const file = this.vault.getAbstractFileByPath(path);
    if (wrapper == null || !(file instanceof TFile)) {
      throw new Error(`invalid character file ${path}`);
    }
    await this.fileManager.processFrontMatter(file, (frontmatter: any) => {
      const changes = new Map<string, any>();
      const character = wrapper.forUpdates(kls, frontmatter, changes);
      updater(character);
      // TODO: do i want to switch back to a more immutable style?
      if (changes.size == 0) {
        // TODO: maybe raise an exception here so that we abort the update rather than do it
        console.debug("no updates for %s", path);
        return;
      }
      // TODO: this doesn't support nested keys
      for (const [key, newValue] of changes) {
        console.log(
          "updating entry %s from %s to %d",
          key,
          frontmatter[key],
          newValue,
        );
        frontmatter[key] = newValue;
      }
    });
  }

  private unindex(path: string): void {
    const removed = this.index.delete(path);
    if (removed) console.debug("removed character cache %s", path);
  }

  public indexFile(file: TFile, cache: CachedMetadata): void {
    const indexKey = file.path;

    // If the file is no longer a character file, remove it from the cache if it existed.
    // TODO: can typescript assert non-nullability?
    if (!isCharacterFile(cache)) {
      this.unindex(indexKey);
      return;
    }

    console.log("indexing %s", indexKey);
    // TODO: write now we're just using ironsworn
    this.index.set(
      indexKey,
      new CharacterWrapper(
        cache.frontmatter,
        new Set([IronswornCharacterMetadata]),
      ),
    );
  }

  get characters(): Map<string, CharacterWrapper> {
    return this.index;
  }

  // characters(): TFile[] {
  //   // TODO: this should be smarter
  //   const charactersFolder = this.app.vault.getAbstractFileByPath("Characters");
  //   if (charactersFolder == null || !(charactersFolder instanceof TFolder)) {
  //     console.warn("Missing characters folder");
  //     return [];
  //   }
  //   return charactersFolder.children.flatMap((childFile) => {
  //     if (childFile instanceof TFile) {
  //       const md = this.app.metadataCache.getFileCache(childFile);
  //       const tags = md != null ? getAllTags(md) ?? [] : [];
  //       if (tags.contains("#character")) {
  //         return [childFile];
  //       } else {
  //         return [];
  //       }
  //     } else {
  //       return [];
  //     }
  //   });
  // }

  // tryFetch(file: TFile): CharacterMetadata | undefined {
  //   try {
  //     return this.fetch(file);
  //   } catch (e) {
  //     console.error(e);
  //     return undefined;
  //   }
  // }

  // fetch(file: TFile): CharacterMetadata {
  //   // const file = this.app.metadataCache.getFirstLinkpathDest(name, sourcePath);
  //   // if (file == null) {
  //   //   throw new Error(`Can't find character file named ${name}`);
  //   // }
  //   const metadata = this.app.metadataCache.getFileCache(file);
  //   if (metadata?.frontmatter === undefined) {
  //     throw new Error(`Can't find metadata for character named ${file.path}`);
  //   }
  //   return new CharacterMetadata(metadata.frontmatter);
  // }
}
