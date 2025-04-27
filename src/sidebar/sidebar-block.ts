import { CampaignDependentBlockRenderer } from "campaigns/campaign-source";
import { CampaignDataContext } from "campaigns/context";
import IronVaultPlugin from "index";
import { rootLogger } from "logger";
import { MoveList } from "./moves";
import renderIronVaultOracles from "./oracles";

export const logger = rootLogger.getLogger("sidebar-block");

export default function registerSidebarBlocks(plugin: IronVaultPlugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    "iron-vault-moves",
    (_source, el: HTMLElement, ctx) => {
      ctx.addChild(
        // TODO:configure embed based on block
        new MovesRenderer(el, plugin, ctx.sourcePath, { embed: true }),
      );
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
  moveList: MoveList;
  constructor(
    containerEl: HTMLElement,
    readonly plugin: IronVaultPlugin,
    sourcePath?: string,
    readonly options: {
      embed?: boolean;
    } = {},
  ) {
    super(containerEl, plugin, sourcePath);
    this.moveList = this.addChild(new MoveList(containerEl, plugin, options));
  }

  render(context: CampaignDataContext) {
    // TODO: this needs to figure out the current view
    this.moveList.updateContext(context, undefined);
  }
}

class OracleRenderer extends CampaignDependentBlockRenderer {
  render(context: CampaignDataContext) {
    renderIronVaultOracles(this.containerEl, this.plugin, context);
  }
}
