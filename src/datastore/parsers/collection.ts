import { Datasworn, DataswornSource } from "@datasworn/core";
import { RulesPackageBuilder } from "@datasworn/core/dist/Builders";
import dataswornSourceSchema from "@datasworn/core/json/datasworn-source.schema.json" assert { type: "json" };
import dataswornSchema from "@datasworn/core/json/datasworn.schema.json" assert { type: "json" };
import Ajv from "ajv";
import { rootLogger } from "logger";
import { App, TFile, TFolder, Vault } from "obsidian";
import { parserForFrontmatter } from "./markdown";

export class InvalidHomebrewError extends Error {}

export async function indexCollectionRoot(app: App, folder: TFolder) {
  if (!RulesPackageBuilder.isInitialized) {
    const ajv = new Ajv({ useDefaults: "empty" });
    ajv.addSchema(dataswornSchema, "Datasworn");
    ajv.addSchema(dataswornSourceSchema, "DataswornSource");
    RulesPackageBuilder.init({
      validator: (data): data is Datasworn.RulesPackage => {
        const result = ajv.validate("Datasworn", data);
        if (!result) {
          throw new InvalidHomebrewError("Failed Datasworn schema validation", {
            cause: ajv.errors,
          });
        }
        return true;
      },
      sourceValidator: (data): data is DataswornSource.RulesPackage => {
        const result = ajv.validate("DataswornSource", data);
        if (!result) {
          throw new InvalidHomebrewError(
            "Failed Datasworn source schema validation",
            {
              cause: ajv.errors,
            },
          );
        }
        return true;
      },
    });
  }

  const builder = new RulesPackageBuilder(
    folder.name,
    rootLogger.getLogger("builder"),
  );

  Vault.recurseChildren(folder, async (file) => {
    if (file instanceof TFile) {
      if (file.extension == "md") {
        const parser = parserForFrontmatter(
          file,
          app.metadataCache.getFileCache(file),
        );
        if (parser) {
          const data = parser(await app.vault.cachedRead(file));
          if (data.success) {
            builder.addFiles({
              name: file.path,
              data: data.rules,
            });
          }
        }
      }
    }
  });
}
