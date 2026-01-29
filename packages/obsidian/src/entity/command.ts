import { CampaignDataContext } from "campaigns/context";
import { determineCampaignContext } from "campaigns/manager";
import { extractDataswornLinkParts } from "datastore/parsers/datasworn/id";
import Handlebars from "handlebars";
import { createOrAppendMechanics } from "mechanics/editor";
import { createOracleGroup } from "mechanics/node-builders";
import { NoSuchOracleError } from "model/errors";
import {
  App,
  Editor,
  MarkdownFileInfo,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  Notice,
} from "obsidian";
import { getExistingOrNewFolder } from "utils/obsidian";
import IronVaultPlugin from "../index";
import { Oracle, OracleRollableRow, RollContext } from "../model/oracle";
import { Roll, RollWrapper } from "../model/rolls";
import { CustomSuggestModal } from "../utils/suggest";
import { EntityModal } from "./modal";
import { NewEntityModal } from "./new-modal";
import {
  ENTITIES,
  EntityAttributeFieldSpec,
  EntityDescriptor,
  EntityResults,
  EntitySpec,
  NewEntityModalResults,
} from "./specs";
import { entityCreateToInlineSyntax, insertInlineText } from "../inline";

type OraclePromptOption =
  | { action: "pick"; row: OracleRollableRow }
  | { action: "roll" };

export async function promptOracleRow(
  app: App,
  oracle: Oracle,
  rollContext: RollContext,
  allowRandom: boolean,
): Promise<Roll> {
  let options: OraclePromptOption[] = allowRandom ? [{ action: "roll" }] : [];
  options = options.concat(
    oracle.rollableRows.map(
      (row): OraclePromptOption => ({ action: "pick", row }),
    ),
  );
  const selection: OraclePromptOption =
    await CustomSuggestModal.select<OraclePromptOption>(
      app,
      options,
      (option) => {
        switch (option.action) {
          case "pick": {
            // NB(@zkat): this field is actually markdown, but we don't want
            // to render it proper, so we do a bit of a maneuver to extract
            // the text itself.
            const div = document.createElement("div");
            MarkdownRenderer.render(
              app,
              option.row.result,
              div,
              "",
              new MarkdownRenderChild(div),
            );
            return div.innerText;
          }
          case "roll":
            return "Roll on the table";
        }
      },
      undefined,
      `Choose an option from the ${oracle.name} table`,
    );

  switch (selection.action) {
    case "pick":
      return oracle.evaluate(rollContext, selection.row.range.min);
    case "roll":
      return oracle.roll(rollContext);
  }
}

async function generateEntityLegacyModal(
  plugin: IronVaultPlugin,
  dataContext: CampaignDataContext,
  entityDesc: EntityDescriptor<EntitySpec>,
): Promise<NewEntityModalResults<EntitySpec>> {
  const rollContext = dataContext.oracleRoller;
  const attributes = Object.entries(entityDesc.spec)
    .filter(
      (keyAndSpec): keyAndSpec is [string, EntityAttributeFieldSpec] =>
        (keyAndSpec[1] as EntityAttributeFieldSpec).definesAttribute !==
        undefined,
    )
    .sort(
      ([, spec1], [, spec2]) =>
        spec1.definesAttribute.order - spec2.definesAttribute.order,
    );

  const initialEntity: Partial<EntityResults<EntitySpec>> = {};
  for (const [key, spec] of attributes) {
    const oracle = rollContext.lookup(spec.id);
    if (!oracle) {
      throw new NoSuchOracleError(spec.id, `missing entity oracle for ${key}`);
    }
    const roll = await promptOracleRow(plugin.app, oracle, rollContext, true);
    initialEntity[key] = [new RollWrapper(oracle, rollContext, roll)];
  }
  return EntityModal.create({
    app: plugin.app,
    entityDesc,
    rollContext,
    initialEntity,
  });
}

async function generateEntityNewModal(
  plugin: IronVaultPlugin,
  dataContext: CampaignDataContext,
  entityDesc: EntityDescriptor<EntitySpec>,
): Promise<NewEntityModalResults<EntitySpec>> {
  const rollContext = dataContext.oracleRoller;
  return NewEntityModal.create({
    plugin,
    entityDesc,
    rollContext,
    initialEntity: {},
  });
}

export async function generateEntityViaModal(
  plugin: IronVaultPlugin,
  campaignContext: CampaignDataContext,
  entityDesc: EntityDescriptor<EntitySpec>,
) {
  if (plugin.settings.useLegacyRoller) {
    return await generateEntityLegacyModal(plugin, campaignContext, entityDesc);
  } else {
    return await generateEntityNewModal(plugin, campaignContext, entityDesc);
  }
}

/** Prompt the user to select an entity type. */
export async function promptForEntityType(
  plugin: IronVaultPlugin,
  campaignContext: CampaignDataContext,
): Promise<EntityDescriptor<EntitySpec>> {
  return await CustomSuggestModal.select(
    plugin.app,
    availableEntityTypes(campaignContext).map(([, v]) => v),
    ({ label }) => label,
    (match, el) => {
      const collId = match.item.collectionId;
      if (collId) {
        const path = extractDataswornLinkParts(collId)!.path;
        const [rulesetId] = path.split("/");
        const ruleset = campaignContext.rulesPackages.get(rulesetId);
        if (ruleset) {
          el.createEl("small", { cls: "iron-vault-suggest-hint" })
            .createEl("strong")
            .createEl("em", { text: ruleset.title });
        }
      }
    },
    "What kind of entity?",
  );
}

/** Returns all available entity types for the given campaign. */
export function availableEntityTypes(
  campaignContext: CampaignDataContext,
): [string, EntityDescriptor<EntitySpec>][] {
  return Object.entries(ENTITIES).filter(([_k, v]) =>
    /*
     * Here we check if every non-templated oracle is included. This is not
     * necessarily the best approach for performance or usability reasons.
     * However, it is the most robust strategy that is easily implemented.
     *
     *TODO(@cwegrzyn): alternatives to consider include:
     * 1. Index these entity generators-- this would be nice because it gives a pathway to define custom entities too
     * 2. Just check if ANY oracle in the faction is present
     */
    Object.values(v.spec).every(
      ({ id }) => id.includes("{{") || campaignContext.oracles.has(id),
    ),
  );
}

export async function generateEntityCommand(
  plugin: IronVaultPlugin,
  editor: Editor,
  view: MarkdownView | MarkdownFileInfo,
  selectedEntityDescriptor?: EntityDescriptor<EntitySpec>,
): Promise<void> {
  const campaignContext = await determineCampaignContext(plugin, view);

  const entityDesc: EntityDescriptor<EntitySpec> =
    selectedEntityDescriptor ??
    (await promptForEntityType(plugin, campaignContext));

  let results: NewEntityModalResults<EntitySpec>;
  try {
    results = await generateEntityViaModal(plugin, campaignContext, entityDesc);
  } catch (e) {
    if (e) {
      new Notice(String(e));
      throw e;
    } else {
      return;
    }
  }

  const { entity, createFile } = results;
  // Check if name is valid (not undefined, empty, or containing literal "undefined")
  const hasValidName =
    results.name && !results.name.toLowerCase().includes("undefined");
  const entityName =
    (hasValidName && results.name) ||
    (createFile && results.fileName) ||
    `New ${entityDesc.label}`;

  let oracleGroupTitle: string;
  let filePath: string | undefined;
  if (createFile) {
    const fileName = results.fileName;
    const folder = await getExistingOrNewFolder(
      plugin.app,
      results.targetFolder,
    );
    const file = await plugin.app.fileManager.createNewMarkdownFile(
      folder,
      fileName,
      Handlebars.compile(
        `
| Name | {{ name }} |
| ---  | --- |
{{#each entity}}
| {{ label }} |  {{ rolls }}  |
{{/each}}
      `.trim(),
        { noEscape: true },
      )(
        {
          entity: Object.entries(entityDesc.spec).flatMap(([key, spec]) => {
            const rolls = entity[key] ?? [];
            if (rolls.length == 0) return [];
            return [
              {
                spec: spec,
                label: spec.name ?? rolls[0].oracle.name,
                rolls: rolls
                  .map((roll) => roll.activeRollWrapper().simpleResult)
                  .join(", "),
              },
            ];
          }),
          name: entityName,
        },
        { allowProtoPropertiesByDefault: true },
      ),
    );
    filePath = file.path;
    oracleGroupTitle = plugin.app.fileManager.generateMarkdownLink(
      file,
      view.file?.path ?? "",
      undefined,
      entityName,
    );

    // If inline mechanics is enabled and we created a file, use inline mechanics
    if (plugin.settings.useInlineMechanics) {
      const inlineText = entityCreateToInlineSyntax(
        entityDesc.label,
        entityName,
        filePath,
      );
      insertInlineText(editor, inlineText);
      return;
    }
  } else {
    oracleGroupTitle = entityName;
  }

  createOrAppendMechanics(editor, [
    createOracleGroup(
      `${entityDesc.label}: ${oracleGroupTitle}`,
      Object.entries(entity).map(([slotKey, rolls]) => {
        const name = entityDesc.spec[slotKey].name;
        return { name, rolls };
      }),
    ),
  ]);
}
