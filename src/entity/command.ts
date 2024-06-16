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
import IronVaultPlugin from "../index";
import { Oracle, OracleRollableRow, RollContext } from "../model/oracle";
import { Roll, RollWrapper } from "../model/rolls";
import { OracleRoller } from "../oracles/roller";
import { CustomSuggestModal } from "../utils/suggest";
import { EntityModal, EntityModalResults } from "./modal";
import {
  ENTITIES,
  EntityAttributeFieldSpec,
  EntityDescriptor,
  EntityResults,
  EntitySpec,
} from "./specs";

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

export async function generateEntity(
  plugin: IronVaultPlugin,
  entityDesc: EntityDescriptor<EntitySpec>,
): Promise<EntityModalResults<EntitySpec>> {
  const { datastore } = plugin;
  if (!datastore.ready) {
    throw new Error("data not ready");
  }
  const rollContext = new OracleRoller(datastore.oracles);
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

export async function generateEntityCommand(
  plugin: IronVaultPlugin,
  editor: Editor,
  ctx: MarkdownView | MarkdownFileInfo,
  selectedEntityDescriptor?: EntityDescriptor<EntitySpec>,
): Promise<void> {
  let entityDesc: EntityDescriptor<EntitySpec>;
  if (!selectedEntityDescriptor) {
    const [, desc] = await CustomSuggestModal.select(
      plugin.app,
      Object.entries(ENTITIES),
      ([_key, { label }]) => label,
      undefined,
      "What kind of entity?",
    );
    entityDesc = desc;
  } else {
    entityDesc = selectedEntityDescriptor;
  }

  let results: EntityModalResults<EntitySpec>;
  try {
    results = await generateEntity(plugin, entityDesc);
  } catch (e) {
    new Notice(String(e));
    throw e;
  }

  const { entity, createFile } = results;

  const entityName = entityDesc.nameGen
    ? entityDesc.nameGen(entity)
    : `New ${entityDesc.label}`;
  let oracleGroupTitle: string;
  if (createFile) {
    const fileName = entityName;
    const file = await plugin.app.fileManager.createNewMarkdownFile(
      plugin.app.fileManager.getNewFileParent(ctx.file?.path ?? "", fileName),
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
                rolls: rolls.map((roll) => roll.simpleResult).join(", "),
              },
            ];
          }),
          name: fileName,
        },
        { allowProtoPropertiesByDefault: true },
      ),
    );
    oracleGroupTitle = plugin.app.fileManager.generateMarkdownLink(
      file,
      ctx.file?.path ?? "",
      undefined,
      entityName,
    );
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
