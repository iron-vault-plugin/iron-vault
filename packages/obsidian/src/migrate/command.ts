import { App, Notice, WorkspaceLeaf } from "obsidian";

import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import semverCompare from "semver/functions/compare";
import { PLUGIN_DATASWORN_VERSION } from "../constants";
import { hasOldId, replaceIds } from "./migration-0_0_10-0_1_0";
import { MIGRATION_VIEW_TYPE } from "./migration-view";

const logger = rootLogger.getLogger("migrate");

class NeedsMigrationError extends Error {}

export async function getVaultDataswornVersion(
  plugin: IronVaultPlugin,
): Promise<string | undefined> {
  return plugin.settings.dataswornVersion;
}

export async function writeVaultDataswornVersion(
  plugin: IronVaultPlugin,
): Promise<void> {
  logger.info(
    "Updating recorded Datasworn version from %s to %s",
    plugin.settings.dataswornVersion,
    PLUGIN_DATASWORN_VERSION,
  );
  plugin.settings.dataswornVersion = PLUGIN_DATASWORN_VERSION;
  await plugin.saveSettings();
}

export async function checkIfMigrationNeeded(
  plugin: IronVaultPlugin,
): Promise<boolean> {
  const vaultDataswornVersion = await getVaultDataswornVersion(plugin);
  if (vaultDataswornVersion) {
    const comparison = semverCompare(
      PLUGIN_DATASWORN_VERSION,
      vaultDataswornVersion,
    );
    switch (comparison) {
      case 0:
        // Versions are equal nothing to do
        return false;
      case 1:
        // Iron Vault Datasworn version is greater than vault version, upgrade needed
        return true;
      case -1: {
        // could cause problems. Warn the user, but do nothing. // The vault version is greater than the Iron Vault version. This is surprising and
        const message = `Your vault appears to use a newer version of Datasworn (${vaultDataswornVersion}) than the currently supported version of Datasworn for this plugin (${PLUGIN_DATASWORN_VERSION}). Perhaps you need to upgrade your plugin version?`;
        logger.warn(message);
        new Notice(message);
        return false;
      }
    }
  } else {
    // No recorded datasworn version -- we need to detect the datasworn version.
    let needsMigration: boolean = false;
    try {
      await Promise.all(
        plugin.app.vault.getMarkdownFiles().map(async (file) => {
          if (hasOldId(await plugin.app.vault.cachedRead(file))) {
            throw new NeedsMigrationError(file.path);
          }
        }),
      );
    } catch (e) {
      if (e instanceof NeedsMigrationError) {
        logger.info("Found file that needs migration: %s", e.message);
        needsMigration = true;
      } else {
        logger.error("Error during migration: ", e);
      }
    }
    if (!needsMigration) {
      // If we don't need migration, but the vault doesn't have a set Datasworn version, let's
      // record it.
      await writeVaultDataswornVersion(plugin);
    }
    return needsMigration;
  }
}

export type MigrationChange = {
  line: number;
  orig: string;
  migrated: string;
  replacements: { offset: number; length: number; newId: string }[];
};

export type MigrationRecord = {
  path: string;
  changes: MigrationChange[];
};

export async function createMigrationReport(
  plugin: IronVaultPlugin,
): Promise<MigrationRecord[]> {
  return (
    await Promise.all(
      plugin.app.vault.getMarkdownFiles().map(async (file) => {
        const changes = (await plugin.app.vault.cachedRead(file))
          .split(/\r\n|\r|\n/g)
          .flatMap((line, index) => {
            const replacements: MigrationChange["replacements"] = [];
            const migrated = replaceIds(line, replacements);
            if (line == migrated) {
              return [];
            }
            return [{ line: index + 1, orig: line, migrated, replacements }];
          });
        return changes.length > 0 ? [{ path: file.path, changes }] : [];
      }),
    )
  ).flat();
}

export function highlightDiff({
  orig,
  replacements,
}: MigrationChange): HTMLElement {
  const el = document.createElement("span");
  el.classList.add("cm-inline-code", "iron-vault-migrate-diff");
  let nextStart = 0;
  for (const { offset, length, newId } of replacements) {
    if (offset > nextStart) {
      el.appendText(orig.slice(nextStart, offset));
    }
    const before = document.createElement("span");
    before.classList.add("before");
    before.textContent = orig.slice(offset, offset + length);
    el.appendChild(before);

    el.appendChild(document.createElement("wbr"));

    const after = document.createElement("span");
    after.classList.add("after");
    after.textContent = newId;
    el.appendChild(after);

    nextStart = offset + length;
  }
  const remainder = orig.slice(nextStart);
  if (remainder) {
    el.appendText(remainder);
  }
  return el;
}

export async function writeMigrationLog(
  app: App,
  report: MigrationRecord[],
  runType: "preview" | "actual" = "preview",
): Promise<void> {
  const reportText = `# MIGRATION LOG

${runType == "preview" ? "This is a preview of the changes that the ID migration would make." : "This is a record of the changes made by the ID migration."}

${report.map(({ path, changes }) => `### ${path}\n\n${changes.map((lineChange) => `Line ${lineChange.line}:\n${highlightDiff(lineChange).outerHTML}\n`).join("\n")}`).join("\n")}`;

  const file = await app.fileManager.createNewMarkdownFile(
    app.fileManager.getNewFileParent(""),
    runType == "preview" ? "Migration Preview" : "Migration Log",
    reportText,
  );

  await app.workspace.getLeaf(false).openFile(file);
}

export async function showMigrationView(app: App): Promise<void> {
  const { workspace } = app;

  let leaf: WorkspaceLeaf | null = null;
  const leaves = workspace.getLeavesOfType(MIGRATION_VIEW_TYPE);

  if (leaves.length > 0) {
    // A leaf with our view already exists, use that
    leaf = leaves[0];
  } else {
    // Our view could not be found in the workspace, create a new leaf
    // in the right sidebar for it
    leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: MIGRATION_VIEW_TYPE, active: true });
  }

  // "Reveal" the leaf in case it is in a collapsed sidebar
  workspace.revealLeaf(leaf);
}

export async function checkIfMigrationNeededCommand(plugin: IronVaultPlugin) {
  plugin.migrationManager.scan();
  /*
  if (await checkIfMigrationNeeded(plugin)) {
    if (
      await YesNoPrompt.show(
        plugin.app,
        `Your vault uses an old version of Datasworn and needs to be migrated to ${PLUGIN_DATASWORN_VERSION}. Would you like to generate a migration report?`,
        "Data migration needed",
      )
    ) {
      await writeMigrationLog(
        plugin.app,
        await createMigrationReport(plugin),
        "preview",
      );

      return;
    }

    if (
      await YesNoPrompt.show(
        plugin.app,
        `Would you like to perform a migration of your vault to Datasworn ${PLUGIN_DATASWORN_VERSION}? Please make a backup of your vault before continuing.`,
        "Data migration needed",
      )
    ) {
      const log = await migrateAllFiles(plugin);
      await writeMigrationLog(plugin.app, log, "actual");
      await writeVaultDataswornVersion(plugin);
    }
  } else if (!quiet) {
    new Notice(
      `Your vault is up-to-date with Datasworn ${PLUGIN_DATASWORN_VERSION}.`,
    );
  }
    */
}

const NEWLINE_REGEX = /(\r\n|\r|\n)/;

export async function migrateAllFiles(
  plugin: IronVaultPlugin,
): Promise<MigrationRecord[]> {
  return (
    await Promise.all(
      plugin.app.vault.getMarkdownFiles().map(async (file) => {
        const record: MigrationRecord = { path: file.path, changes: [] };

        await plugin.app.vault.process(file, (data) => {
          const linesAndSeps = data.split(NEWLINE_REGEX);
          let lineNo = 1;
          linesAndSeps.forEach((line, idx) => {
            const replacements: MigrationChange["replacements"] = [];
            if (line.match(NEWLINE_REGEX)) {
              lineNo += 1;
            } else {
              linesAndSeps[idx] = replaceIds(line, replacements);
              if (replacements.length > 0) {
                record.changes.push({
                  line: lineNo,
                  orig: line,
                  migrated: linesAndSeps[idx],
                  replacements,
                });
              }
            }
          });
          return linesAndSeps.join("");
        });

        return record.changes.length > 0 ? [record] : [];
      }),
    )
  ).flat();
}
