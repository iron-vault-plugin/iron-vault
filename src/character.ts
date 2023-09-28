import {
  type App,
  TFile,
  getAllTags,
  type CachedMetadata,
  type FrontMatterCache,
  Component,
  type MetadataCache,
  type Vault,
  type FileManager,
} from "obsidian";
// import { getAPI } from "obsidian-dataview";

// const api = getAPI();

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

export default class CharacterTracker extends Component {
  metadataCache: MetadataCache;
  vault: Vault;
  fileManager: FileManager;

  /** Map file paths to metadata. */
  index: Map<string, CharacterMetadata>;

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
        console.log("changed: ", file);
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

  public async updateCharacter(
    path: string,
    updater: (character: CharacterMetadata, frontmatter: any) => boolean,
  ): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (!this.index.has(path) || !(file instanceof TFile)) {
      throw new Error(`invalid character file ${path}`);
    }
    await this.fileManager.processFrontMatter(file, (frontmatter: any) => {
      const character = new CharacterMetadata(frontmatter);
      // TODO: do i want to switch back to a more immutable style?
      if (!updater(character, frontmatter)) {
        // TODO: maybe raise an exception here so that we abort the update rather than do it
        console.debug("no updates for %s", path);
        return;
      }
      for (const [key, newValue] of character.changes) {
        console.log(
          "updating entry %s from %s to %d",
          key,
          character._data[key],
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
    this.index.set(indexKey, new CharacterMetadata(cache.frontmatter));
  }

  get characters(): Map<string, CharacterMetadata> {
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

interface Measure {
  /** Kind of measure. Meters change; stats do not. */
  kind: "meter" | "stat";

  /** Internal ID */
  id: string;

  /** How should we show this in the UI? */
  label: string;

  /** Where does this live in frontmatter data? */
  dataPath: string;
}

export type MeasureSpec = Record<string, Measure>;

export const IronswornMeasures = {
  heart: {
    kind: "stat",
    id: "heart",
    label: "Heart",
    dataPath: "heart",
  },
  wits: {
    kind: "stat",
    id: "wits",
    label: "Wits",
    dataPath: "wits",
  },
  shadow: {
    kind: "stat",
    id: "shadow",
    label: "Shadow",
    dataPath: "shadow",
  },
  edge: {
    kind: "stat",
    id: "edge",
    label: "Edge",
    dataPath: "edge",
  },
  iron: {
    kind: "stat",
    id: "iron",
    label: "Iron",
    dataPath: "iron",
  },
  momentum: {
    kind: "meter",
    id: "momentum",
    label: "Momentum",
    dataPath: "momentum",
  },
} satisfies MeasureSpec;

export type MeasureSet<T extends MeasureSpec> = Record<keyof T, number>;

export type IrowswornMeasureSet = MeasureSet<typeof IronswornMeasures>;

export class CharacterMetadata {
  public changes: Map<string, any>;

  constructor(public readonly _data: any) {
    this.changes = new Map();
  }

  public measures<T extends Record<string, any>>(
    measureClass: T,
  ): MeasureSet<T> {
    const changes = this.changes;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const obj: MeasureSet<T> = {} as MeasureSet<T>;
    for (const [name, measure] of Object.entries(measureClass)) {
      const val = Number.isInteger(this._data[name])
        ? this._data[name]
        : typeof this._data[name] === "string"
        ? Number.parseInt(this._data[name])
        : null;
      Object.defineProperty(obj, name, {
        enumerable: true,
        get: () => changes.get(measure.dataPath) ?? val,
        set: (newValue: any) => {
          newValue = Number.isInteger(newValue)
            ? newValue
            : Number.parseInt(newValue);
          if (Number.isNaN(newValue)) {
            throw new TypeError(`${name} must be an integer.`);
          }
          if (val === newValue) {
            changes.delete(name);
          } else {
            changes.set(name, newValue);
          }
        },
      });
    }
    return obj;
  }

  get name(): string {
    return this._data.name;
  }
}
