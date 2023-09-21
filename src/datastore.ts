import { type App } from "obsidian";
import { type Move, type Starforged } from "dataforged";

export type { Move };

export class Datastore {
  private readonly app: App;
  _data: Starforged | undefined;

  constructor(app: App) {
    this.app = app;
    this._data = undefined;
  }

  async load(normalizdPath: string): Promise<void> {
    // const data = await this.app.vault.cachedRead(file);
    const data = await this.app.vault.adapter.read(normalizdPath);
    this._data = JSON.parse(data);
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

  private assertReady(): asserts this is { _data: Starforged } {
    if (this._data == null) {
      throw new Error("data not loaded yet");
    }
  }
}
