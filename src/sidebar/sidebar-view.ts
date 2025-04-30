import { html, render } from "lit-html";
import { App, ItemView, MarkdownView, WorkspaceLeaf } from "obsidian";

import IronVaultPlugin from "index";
import { CharacterRenderer } from "./character";
import { MoveList } from "./moves";
import { OracleList } from "./oracles";
export const SIDEBAR_VIEW_TYPE = "iron-vault-sidebar-view";

export class SidebarView extends ItemView {
  plugin: IronVaultPlugin;
  moveList!: MoveList;
  oracleList!: OracleList;
  characterView!: CharacterRenderer;

  static async activate(app: App, moveId: string) {
    const { workspace } = app;
    for (const leaf of app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)) {
      if (leaf.view instanceof SidebarView) {
        workspace.revealLeaf(leaf);
        leaf.view.moveList.scrollToMove(moveId);
        return;
      }
    }
  }

  async initMainSidebarView() {
    for (const leaf of this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)) {
      return leaf;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf?.setViewState({
      type: SIDEBAR_VIEW_TYPE,
    });
    return leaf;
  }

  constructor(leaf: WorkspaceLeaf, plugin: IronVaultPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return SIDEBAR_VIEW_TYPE;
  }

  getDisplayText() {
    return "Iron Vault";
  }

  getIcon() {
    return "iron-vault";
  }

  async onOpen() {
    this.contentEl.empty();
    const tpl = html`
      <nav class="iron-vault-sidebar-view tabs">
        <div class="tab">
          <input type="radio" name="tab-group" id="oracle-tab" checked />
          <label for="oracle-tab">Oracles</label>
          <div class="content oracle-tab"></div>
        </div>
        <div class="tab">
          <input type="radio" name="tab-group" id="move-tab" />
          <label for="move-tab">Moves</label>
          <div class="content move-tab"></div>
        </div>
        <div class="tab">
          <input type="radio" name="tab-group" id="character-tab" />
          <label for="character-tab">Character</label>
          <div class="content character-tab"></div>
        </div>
      </nav>
    `;
    render(tpl, this.contentEl);

    this.moveList = this.addChild(
      new MoveList(
        this.contentEl.querySelector(".content.move-tab")!,
        this.plugin,
      ),
    );

    this.oracleList = this.addChild(
      new OracleList(
        this.contentEl.querySelector(".content.oracle-tab")!,
        this.plugin,
      ),
    );

    this.characterView = this.addChild(
      new CharacterRenderer(
        this.contentEl.querySelector(".content.character-tab")!,
        this.plugin,
      ),
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.moveList.updateView(this.getActiveMarkdownView());
        this.oracleList.updateView(this.getActiveMarkdownView());
      }),
    );
  }

  private getActiveMarkdownView(): MarkdownView | undefined {
    const view = this.plugin.app.workspace.getActiveFileView();
    return view && view instanceof MarkdownView ? view : undefined;
  }

  async onClose() {
    // Nothing to clean up.
  }
}
