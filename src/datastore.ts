import {
  type Move,
  type OracleBase,
  type OracleSet,
  type OracleTable,
  type Starforged,
} from "dataforged";
import { Component, type App } from "obsidian";
import { OracleRoller } from "oracles/roller";

export { type Move };

type OracleMap = Map<string, OracleTable | OracleSet>;

function indexIntoOracleMap(index: OracleMap, data: Starforged): void {
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
}

export class OracleIndex
  implements ReadonlyMap<string, OracleTable | OracleSet>
{
  static fromData(data: Starforged): OracleIndex {
    const map = new Map();
    indexIntoOracleMap(map, data);
    return new OracleIndex(map);
  }

  constructor(protected readonly _index: OracleMap) {}

  forEach(
    callbackfn: (
      value: OracleSet | OracleTable,
      key: string,
      map: ReadonlyMap<string, OracleSet | OracleTable>,
    ) => void,
    thisArg?: any,
  ): void {
    throw new Error("Method not implemented.");
  }

  get(key: string): OracleSet | OracleTable | undefined {
    return this._index.get(key);
  }

  has(key: string): boolean {
    return this._index.has(key);
  }

  get size(): number {
    return this._index.size;
  }

  entries(): IterableIterator<[string, OracleSet | OracleTable]> {
    return this._index.entries();
  }

  keys(): IterableIterator<string> {
    return this._index.keys();
  }

  values(): IterableIterator<OracleSet | OracleTable> {
    return this._index.values();
  }

  [Symbol.iterator](): IterableIterator<[string, OracleSet | OracleTable]> {
    return this._index[Symbol.iterator]();
  }

  *tables(): IterableIterator<OracleTable> {
    for (const table of this._index.values()) {
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
  _data: Starforged | undefined;
  _oracleMap: OracleMap;
  _oracleIndex: OracleIndex;

  constructor(public readonly app: App) {
    super();
    this._data = undefined;

    // create an empty oracle index initially
    this._oracleMap = new Map();
    this._oracleIndex = new OracleIndex(this._oracleMap);
  }

  public initialize(jsonPath: string): void {
    void this.loadFile(jsonPath);
  }

  async loadFile(normalizdPath: string): Promise<void> {
    // const data = await this.app.vault.cachedRead(file);
    const data = await this.app.vault.adapter.read(normalizdPath);
    this._data = JSON.parse(data);
    indexIntoOracleMap(this._oracleMap, this._data as Starforged);
    this.app.metadataCache.trigger("forged:index-changed");
  }

  get ready(): boolean {
    return this._data != null;
  }

  get data(): Starforged | undefined {
    return this._data;
  }

  get moves(): Move[] {
    this.assertReady();
    return Object.values(this._data["Move categories"]).flatMap((category) => {
      return Object.values(category.Moves).map((m) => {
        return m;
      });
    });
  }

  get oracles(): OracleIndex {
    this.assertReady();
    return this._oracleIndex;
  }

  get roller(): OracleRoller {
    this.assertReady();
    return new OracleRoller(this._oracleIndex);
  }

  private assertReady(): asserts this is {
    _data: Starforged;
    _oracleIndex: OracleIndex;
  } {
    if (this._data == null) {
      throw new Error("data not loaded yet");
    }
  }
}
