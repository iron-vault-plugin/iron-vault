import Handlebars from "handlebars";

import IronVaultPlugin from "index";

export async function generateTruthsCommand(plugin: IronVaultPlugin) {
  const truths = [...plugin.datastore.truths.values()];
  const text = Handlebars.compile(
    `{{#each truths}}## {{truth.name}}\n\`\`\`iron-vault-truth\n{{truth.name}}\n\`\`\`\n{{/each}}`,
  )({ truths });
  // TODO: prompt for file name/dirname, with a default of putting it in a
  // toplevel `Truths.md` file.
}
