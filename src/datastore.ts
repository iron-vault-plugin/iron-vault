import { type App } from "obsidian";
import { type Move, type Starforged, type OracleBase } from "dataforged";

export type { Move };

function indexOracles(data: Starforged): Map<string, OracleBase> {
  const index = new Map<string, OracleBase>();
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

export class Datastore {
  private readonly app: App;
  _data: Starforged | undefined;
  _oracleIndex: Map<string, OracleBase> | undefined;

  constructor(app: App) {
    this.app = app;
    this._data = undefined;
  }

  async load(normalizdPath: string): Promise<void> {
    // const data = await this.app.vault.cachedRead(file);
    const data = await this.app.vault.adapter.read(normalizdPath);
    this._data = JSON.parse(data);
    this._oracleIndex = indexOracles(this._data as Starforged);
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

  get oracles(): Map<string, OracleBase> {
    this.assertReady();
    return this._oracleIndex;
  }

  private assertReady(): asserts this is {
    _data: Starforged;
    _oracleIndex: Map<string, OracleBase>;
  } {
    if (this._data == null) {
      throw new Error("data not loaded yet");
    }
  }
}
