import {
  type Move,
  type OracleBase,
  type OracleSet,
  type OracleTable,
  type Starforged,
} from "dataforged";
import { PriorityIndexer } from "datastore/priority-index";
import { Component, type App } from "obsidian";
import { OracleRoller } from "oracles/roller";

export { type Move };

type OracleMap = Map<string, OracleTable | OracleSet>;

export interface OraclePackage {
  data: OracleMap;
  source: string;
  priority: number;
}

function indexIntoOracleMap(data: Starforged): OracleMap {
  const index = new Map();
  function expand(oracleBase: OracleBase, prefix: string[]): void {
    index.set(oracleBase.$id, oracleBase);
    if (oracleBase.Sets != null) {
      for (const [name, set] of Object.entries(oracleBase.Sets)) {
        expand(set, prefix.concat([name]));
      }
    }
    if (oracleBase.Tables != null) {
      for (const [name, set] of Object.entries(oracleBase.Tables)) {
        expand(set, prefix.concat(name));
      }
    }
  }
  if (data?.["Oracle sets"] == null) {
    throw new Error("Oracle data seems to be missing");
  }
  for (const [name, set] of Object.entries(data["Oracle sets"])) {
    expand(set, [name]);
  }
  return index;
}

export class OracleIndex extends PriorityIndexer<
  string,
  OracleSet | OracleTable
> {
  *tables(): IterableIterator<OracleTable> {
    for (const table of this.values()) {
      if ("Table" in table) {
        yield table;
      }
    }
  }

  /**
   * Retrieve an oracle table from the index.
   * @param id ID of oracle table
   * @returns oracle table or undefined if the table is missing or is an OracleSet
   */
  getTable(id: string): OracleTable | undefined {
    const oracle = this.get(id);
    if (oracle == null || !("Table" in oracle)) {
      return undefined;
    }
    return oracle;
  }
}

export class Datastore extends Component {
  _oracleMap: OracleMap;
  _oracleIndex: OracleIndex;
  _moveIndex: PriorityIndexer<string, Move>;
  _ready: boolean;

  constructor(public readonly app: App) {
    super();
    this._ready = false;

    this._oracleIndex = new OracleIndex();
    this._moveIndex = new PriorityIndexer();
  }

  async initialize(jsonPath: string): Promise<void> {
    await this.indexPluginFile(jsonPath, 0);
    this._ready = true;
  }

  async indexPluginFile(
    normalizedPath: string,
    priority: number,
  ): Promise<void> {
    // const data = await this.app.vault.cachedRead(file);
    const data = JSON.parse(
      await this.app.vault.adapter.read(normalizedPath),
    ) as Starforged;
    this._oracleIndex.indexSource(
      normalizedPath,
      priority,
      indexIntoOracleMap(data),
    );
    this._moveIndex.indexSource(
      normalizedPath,
      priority,
      Object.values(data["Move categories"]).flatMap(
        (category): Array<[string, Move]> => {
          return Object.values(category.Moves).map((m) => {
            return [m.$id, m];
          });
        },
      ),
    );
    this.app.metadataCache.trigger("forged:index-changed");
  }

  get ready(): boolean {
    return this._ready;
  }

  // get data(): Starforged | undefined {
  //   return this._data;
  // }

  get moves(): Move[] {
    this.assertReady();
    return [...this._moveIndex.values()];
  }

  get oracles(): OracleIndex {
    this.assertReady();
    return this._oracleIndex;
  }

  get roller(): OracleRoller {
    this.assertReady();
    return new OracleRoller(this._oracleIndex);
  }

  private assertReady(): void {
    if (!this._ready) {
      throw new Error("data not loaded yet");
    }
  }
}
