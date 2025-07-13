import { html, render } from "lit-html";
import {
  App,
  ItemView,
  MarkdownView,
  ViewStateResult,
  WorkspaceLeaf,
} from "obsidian";

import IronVaultPlugin from "index";
import { CharacterRenderer } from "./character";
import { MoveList } from "./moves";
import { OracleList } from "./oracles";
export const SIDEBAR_VIEW_TYPE = "iron-vault-sidebar-view";

export type SidebarViewState = {
  activeTab: string;
};

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
        leaf.setEphemeralState({ moveId });
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

  setActiveTab = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const tabName = target.dataset.tab;
    if (!tabName) return;

    this.setActiveTabByName(tabName);
  };

  setActiveTabByName = (tabName: string) => {
    const tabs = this.contentEl.querySelectorAll(
      ":scope > .iron-vault-sidebar-view .content",
    );
    for (const tab of tabs) {
      tab.classList.remove("is-active");
      if (tab.classList.contains(`${tabName}-tab`)) {
        tab.classList.add("is-active");
      }
    }

    const buttons = this.contentEl.querySelectorAll(
      ":scope > .nav-header .nav-action-button",
    ) as NodeListOf<HTMLDivElement>;
    for (const button of buttons) {
      button.classList.remove("is-active");
      if (button.dataset.tab === tabName) {
        button.classList.add("is-active");
      }
    }
  };

  async onOpen() {
    this.contentEl.empty();

    const tpl = html`
      <div class="nav-header">
        <div class="nav-buttons-container" @click=${this.setActiveTab}>
          <div class="nav-action-button clickable-icon" data-tab="oracle">
            Oracles
          </div>
          <div class="nav-action-button clickable-icon" data-tab="move">
            Moves
          </div>
          <div class="nav-action-button clickable-icon" data-tab="character">
            Character
          </div>
        </div>
      </div>
      <div class="iron-vault-sidebar-view tabs">
        <div class="content oracle-tab"></div>
        <div class="content move-tab"></div>
        <div class="content character-tab"></div>
      </div>
    `;
    render(tpl, this.contentEl);

    this.setActiveTabByName("oracle");

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

    this.app.workspace.onLayoutReady(() => {
      this.moveList.updateView(this.getActiveMarkdownView());
      this.oracleList.updateView(this.getActiveMarkdownView());
    });
  }

  getState(): SidebarViewState {
    const state = super.getState();
    return {
      ...state,
      activeTab:
        (
          this.contentEl.querySelector(
            ":scope > .nav-header .nav-action-button.is-active",
          ) as HTMLDivElement | null
        )?.dataset.tab || "oracle",
    };
  }

  setState(state: unknown, result: ViewStateResult): Promise<void> {
    // This is called when the view is restored from a saved state.
    // We can use this to restore the active tab if needed.
    if (state && typeof state === "object" && "activeTab" in state) {
      this.setActiveTabByName(state.activeTab as string);
    }
    return super.setState(state, result);
  }

  setEphemeralState(state: unknown): void {
    if (state && typeof state === "object" && "moveId" in state) {
      this.setActiveTabByName("move");
      this.moveList.scrollToMove(state.moveId as string);
    }
  }

  private getActiveMarkdownView(): MarkdownView | undefined {
    const view = this.plugin.app.workspace.getActiveFileView();
    return view && view instanceof MarkdownView ? view : undefined;
  }

  async onClose() {
    // Nothing to clean up.
  }
}
