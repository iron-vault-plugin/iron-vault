import IronVaultPlugin from "index";
import { EventRef, Events } from "obsidian";
import {
  checkIfMigrationNeeded,
  createMigrationReport,
  migrateAllFiles,
  MigrationRecord,
  writeVaultDataswornVersion,
} from "./command";

export class MigrationManager {
  #state: MigrationStage = MigrationStage.Initial;

  migrationNeeded?: boolean;
  lastReport?: MigrationRecord[];

  events: Events = new Events();

  constructor(protected readonly plugin: IronVaultPlugin) {}

  get state(): MigrationStage {
    return this.#state;
  }

  async scan(): Promise<void> {
    if (this.active()) return;
    // Reset the state
    this.migrationNeeded = undefined;
    this.updateState(MigrationStage.Scanning);

    // Update it eventually
    this.migrationNeeded = await checkIfMigrationNeeded(this.plugin);
    this.updateState(MigrationStage.Scanned);
    if (this.migrationNeeded) {
      this.trigger("needs-migration", this);
    }
  }

  async generateReport() {
    if (this.active()) return;

    this.updateState(MigrationStage.GeneratingReport);
    this.lastReport = await createMigrationReport(this.plugin);
    this.updateState(MigrationStage.ReportGenerated);
  }

  async performMigration() {
    if (this.active()) return;

    this.updateState(MigrationStage.Migrating);
    this.lastReport = await migrateAllFiles(this.plugin);
    await writeVaultDataswornVersion(this.plugin);
    this.updateState(MigrationStage.MigrationComplete);
  }

  protected updateState(newState: MigrationStage) {
    this.#state = newState;
    this.trigger("changed", this);
  }

  active(): boolean {
    switch (this.#state) {
      case MigrationStage.Initial:
      case MigrationStage.Scanned:
      case MigrationStage.ReportGenerated:
      case MigrationStage.MigrationComplete:
        return false;
      case MigrationStage.Scanning:
      case MigrationStage.GeneratingReport:
      case MigrationStage.Migrating:
        return false;
    }
  }

  on(
    name: "changed",
    callback: (manager: this) => unknown,
    ctx?: unknown,
  ): EventRef;
  on(
    name: "needs-migration",
    callback: (manager: this) => unknown,
    ctx?: unknown,
  ): EventRef;
  on(
    name: string,
    callback: (...data: never[]) => unknown,
    ctx?: unknown,
  ): EventRef {
    return this.events.on(name, callback, ctx);
  }

  off(name: string, callback: (...data: unknown[]) => unknown): void {
    this.events.off(name, callback);
  }

  offref(ref: EventRef): void {
    this.events.offref(ref);
  }

  protected trigger(name: "changed", manager: this): void;
  protected trigger(name: "needs-migration", manager: this): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected trigger(name: string, ...data: unknown[]): void {
    this.events.trigger(name, ...data);
  }
}

export enum MigrationStage {
  Initial,
  Scanning,
  Scanned,
  GeneratingReport,
  ReportGenerated,
  Migrating,
  MigrationComplete,
}
