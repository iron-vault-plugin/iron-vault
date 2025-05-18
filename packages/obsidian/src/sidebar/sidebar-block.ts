import IronVaultPlugin from "index";
import { MoveList } from "./moves";
import { OracleList } from "./oracles";

export default function registerSidebarBlocks(plugin: IronVaultPlugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-moves",
    (_source, el: HTMLElement, ctx) => {
      ctx.addChild(new MoveList(el, plugin, { embed: true }, ctx.sourcePath));
    },
  );

  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-oracles",
    (_source, el: HTMLElement, ctx) => {
      ctx.addChild(new OracleList(el, plugin, ctx.sourcePath));
    },
  );
}
