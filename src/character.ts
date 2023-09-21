import {
  type App,
  type TFile,
  getAllTags,
  type Plugin,
  type CachedMetadata,
  type FrontMatterCache,
  Component,
  type MetadataCache,
  type Vault,
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

  /** Map file paths to metadata. */
  index: Map<string, CharacterMetadata>;

  constructor(app: App) {
    super();

    this.metadataCache = app.metadataCache;
    this.vault = app.vault;
    this.index = new Map();
  }

  public initialize(): void {
    this.registerEvent(
      this.metadataCache.on("changed", (file, data, cache) => {
        console.log("changed: ", file);
        this.indexFile(file, cache);
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

const DEFAULT_MEASURES = ["heart", "wits", "iron", "shadow", "edge"];

interface Measure {
  name: string;
  value: number | null;
  source: string;
}

export class CharacterMetadata {
  data: Record<string, any>;
  readonly measures: Readonly<Record<string, Readonly<Measure>>>;

  constructor(data: Record<string, any>) {
    console.log(data);
    this.data = data;
    const calcMeasures: Record<string, Measure> = {};
    DEFAULT_MEASURES.forEach((name) => {
      calcMeasures[name] = {
        name,
        value: Number.isInteger(this.data[name]) ? this.data[name] : null,
        source: "Character",
      };
    });
    this.measures = calcMeasures;
  }

  get name(): string {
    return this.data.name;
  }

  measure(name: string): number | undefined {
    return this.data[name];
  }
}
