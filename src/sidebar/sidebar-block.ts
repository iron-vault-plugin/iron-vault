import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { CampaignDataContext } from "campaigns/context";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import renderIronVaultMoves from "./moves";
import renderIronVaultOracles from "./oracles";

export const logger = rootLogger.getLogger("sidebar-block");

export default function registerSidebarBlocks(plugin: IronVaultPlugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-moves",
    (_source, el: HTMLElement, ctx) => {
      ctx.addChild(new MovesRenderer(el, plugin, ctx.sourcePath));
    },
  );

  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-oracles",
    (_source, el: HTMLElement, ctx) => {
      ctx.addChild(new OracleRenderer(el, plugin, ctx.sourcePath));
    },
  );
}

class MovesRenderer extends CampaignDependentBlockRenderer {
  render(context: CampaignDataContext) {
    renderIronVaultMoves(this.containerEl, this.plugin, context);
  }
}

class OracleRenderer extends CampaignDependentBlockRenderer {
  render(context: CampaignDataContext) {
    renderIronVaultOracles(this.containerEl, this.plugin, context);
  }
}
