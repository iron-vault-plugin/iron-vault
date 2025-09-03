import { atOrChildOfPath, relativeTo } from "@ironvault/utils/paths";
import { DataManager } from "datastore/loader/manager";
import { html, nothing, render, TemplateResult } from "lit-html";
import { join } from "lit-html/directives/join.js";
import { map } from "lit-html/directives/map.js";
import { when } from "lit-html/directives/when.js";
import { debounce, FileView, TFile, WorkspaceLeaf } from "obsidian";

export const CONTENT_VIEW_TYPE = "iron-vault-datasworn-content-view";

export class ContentView extends FileView {
  activeStatus: ReturnType<DataManager["getPackageForPath"]> | undefined;

  shouldUpdate: () => void;
  constructor(
    leaf: WorkspaceLeaf,
    private readonly manager: DataManager,
  ) {
    super(leaf);
    this.navigation = false;
    this.allowNoFile = true;
    this.shouldUpdate = debounce(this.update.bind(this), 100);
  }

  getViewType(): string {
    return CONTENT_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return "Iron Vault Homebrew Inspector";
  }

  override getIcon() {
    // TODO: magnifying glass?
    return "package-search";
  }

  update(): void {
    const newStatus = this.file
      ? this.manager.getPackageForPath(this.file.path)
      : undefined;
    if (newStatus !== this.activeStatus) {
      this.activeStatus = newStatus;
      this.render();
    }
  }

  override onload(): void {
    super.onload();
    this.registerEvent(
      this.app.workspace.on("file-open", (file: TFile | null) => {
        if (file instanceof TFile) {
          this.loadFile(file);
        }
      }),
    );
    this.app.workspace.onLayoutReady(() => {
      const f = this.app.workspace.getActiveFile();
      if (f instanceof TFile) {
        console.log("ContentView: onload: active file found", f.path);
        this.loadFile(f);
      }
    });
    this.register(
      this.manager.on("updated:package", ({ root }) => {
        // If this is our root, we should refresh the view
        if (this.file && atOrChildOfPath(root, this.file.path)) {
          this.shouldUpdate();
        }
      }),
    );
  }

  protected override async onOpen(): Promise<void> {
    await super.onOpen();
    this.update();
  }

  render() {
    let template: TemplateResult;
    const rootStatus = this.activeStatus;
    if (!rootStatus) {
      template = html`<div
        class="tree-item-self is-clickable is-collapsed"
        aria-label="No content"
      >
        <div class="tree-item-inner">Not part of package</div>
      </div>`;
    } else {
      const { root, files } = rootStatus;
      const errors = files
        .values()
        .filter((status) => status.isErr)
        .reduce((acc) => acc + 1, 0);
      const activeResult = this.file ? files.get(this.file!.path) : undefined;
      const entries = [...files.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      );
      template = html`<div class="iv-content-pane">
        ${tree({
          key: root,
          ariaLabel: "Root of package",
          inner: root,
          flair: errors > 0 ? "error" : undefined,
          children: html`${map(entries, ([path, _error]) =>
            tree({
              key: path,
              inner: relativeTo(root, path)! || "<root>",
              onClick: this._click,
              flair: _error.isErr ? "error" : undefined,
              active: this.file!.path === path,
            }),
          )}`,
        })}
        <div class="iv-content-view">
          ${when(activeResult, (res) => {
            if (res.isErr) {
              const problem = res.error;
              switch (problem._tag) {
                case "SchemaValidationFailedProblem":
                  return html`<div class="error-message">
                    <strong>Error loading file:</strong>
                    ${map(
                      problem.errors.sort((a, b) =>
                        a.instancePath.localeCompare(b.instancePath),
                      ),
                      (e) => html`
                        <dl>
                          ${map(
                            Object.entries(e),
                            ([key, value]) =>
                              html`<dt data-key="${key}">${key}</dt>
                                ${typeof value === "string"
                                  ? // prettier-ignore
                                    html`<dd data-key=${key}">${join(value.split('/'), html`&ZeroWidthSpace;/&ZeroWidthSpace;`)}</dd>`
                                  : // prettier-ignore
                                    html`<dd data-key="${key}">${JSON.stringify(value, undefined, 2)}</dd>`}`,
                          )}
                        </dl>
                      `,
                    )}
                  </div>`;
                case "ContentValidationFailedProblem":
                  return html`<div class="error-message">
                    <strong>Content validation errors:</strong>
                    <dl>
                      ${map(
                        problem.errors.sort((a, b) =>
                          a.instancePath.localeCompare(b.instancePath),
                        ),
                        (e) =>
                          // prettier-ignore
                          html`<dt data-key="${e.instancePath}">${e.instancePath}</dt>
                            <dd data-key="${e.instancePath}">${e.message}</dd> `,
                      )}
                    </dl>
                  </div>`;
                case "ErrorProblem":
                  return html`<p class="error-message">
                    <strong>Error loading file:</strong> ${problem.message}
                  </p>`;
                case "WrongDataswornVersionProblem":
                  return html`<p class="error-message">
                    <strong>Unsupported Datasworn version:</strong>
                    ${problem.message}
                  </p>`;
              }
            } else {
              return html`<p>Successfully parsed.</p>`;
            }
          })}
        </div>
      </div>`;
    }
    render(template, this.contentEl);
  }

  _click = (ev: PointerEvent): void => {
    const target = ev.target as HTMLElement;
    if (target.closest(".tree-item-self")) {
      const path = target.closest(".tree-item-self")?.getAttribute("data-path");
      if (
        path &&
        this.file &&
        (this.activeStatus!.root == path ||
          relativeTo(this.activeStatus!.root, path) !== null)
      ) {
        // this.app.workspace
        //   .getLeaf(false)
        //   .openFile(this.app.vault.getAbstractFileByPath(path) as TFile);
        this.loadFile(this.app.vault.getAbstractFileByPath(path) as TFile);
      }
    }
  };

  override async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.shouldUpdate();
  }

  override async onUnloadFile(file: TFile): Promise<void> {
    await super.onUnloadFile(file);
  }
}

interface TreeNode {
  key: string;
  ariaLabel?: string;
  onClick?: (ev: PointerEvent) => void;
  inner?: TemplateResult | string;
  children?: TemplateResult | string;
  flair?: TemplateResult | string;
  flairClass?: string;
  active?: boolean;
}

function tree(node: TreeNode): TemplateResult {
  return html`<div class="tree-item">
    <div
      class="tree-item-self ${node.onClick ? "is-clickable" : ""} ${node.active
        ? "is-active"
        : ""}"
      aria-label="${node.ariaLabel || nothing}"
      @click="${node.onClick || nothing}"
      data-path="${node.key}"
    >
      <div class="tree-item-inner">${node.inner}</div>
      ${when(
        node.flair,
        () =>
          html`<div class="tree-item-flair-outer">
            <span class="tree-item-flair ${node.flairClass}"
              >${node.flair}</span
            >
          </div>`,
      )}
    </div>
    <div class="tree-item-children">${node.children}</div>
  </div>`;
}
