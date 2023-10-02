import {
  type Move,
  type OracleBase,
  type OracleSet,
  type OracleTable,
  type Starforged,
} from "dataforged";
import { type App } from "obsidian";

export { type Move };

type OracleMap = Map<string, OracleTable | OracleSet>;

function createOracleMap(data: Starforged): OracleMap {
  const index: OracleMap = new Map();
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
  for (const [name, set] of Object.entries(data["Oracle sets"])) {
    expand(set, [name]);
  }
  return index;
}

export class OracleIndex
  implements ReadonlyMap<string, OracleTable | OracleSet>
{
  static fromData(data: Starforged): OracleIndex {
    return new OracleIndex(createOracleMap(data));
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

export class Datastore {
  private readonly app: App;
  _data: Starforged | undefined;
  _oracleIndex: OracleIndex | undefined;

  constructor(app: App) {
    this.app = app;
    this._data = undefined;
  }

  async load(normalizdPath: string): Promise<void> {
    // const data = await this.app.vault.cachedRead(file);
    const data = await this.app.vault.adapter.read(normalizdPath);
    this._data = JSON.parse(data);
    this._oracleIndex = OracleIndex.fromData(this._data as Starforged);
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

  private assertReady(): asserts this is {
    _data: Starforged;
    _oracleIndex: OracleIndex;
  } {
    if (this._data == null) {
      throw new Error("data not loaded yet");
    }
  }
}
