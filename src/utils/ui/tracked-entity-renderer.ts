import IronVaultPlugin from "index";
import { Index } from "indexer";
import { html, render } from "lit-html";
import { rootLogger } from "logger";
import { debounce, MarkdownRenderChild } from "obsidian";
import { IronVaultPluginSettings } from "settings";

const logger = rootLogger.getLogger("tracked-entity");

export abstract class TrackedEntityRenderer<
  T,
  E extends Error,
> extends MarkdownRenderChild {
  #sourcePath: string;

  constructor(
    containerEl: HTMLElement,
    sourcePath: string,
    public readonly plugin: IronVaultPlugin,
    public readonly index: Index<T, E>,
    public readonly kind: string,
  ) {
    super(containerEl);
    this.#sourcePath = sourcePath;
    logger.debug(
      "[tracked-entity-renderer(%s): %s] Initializing",
      this.kind,
      this.sourcePath,
    );
  }

  get sourcePath(): string {
    return this.#sourcePath;
  }

  async onload() {
    logger.debug(
      "[tracked-entity-renderer(%s): %s] onload",
      this.kind,
      this.sourcePath,
    );

    const rerender = debounce(() => this.render(), 100);

    this.registerEvent(
      this.index.on("changed", (changedPath) => {
        if (changedPath === this.sourcePath) {
          logger.debug(
            "[tracked-entity-renderer(%s): %s] changed",
            this.kind,
            this.sourcePath,
          );
          rerender();
        }
      }),
    );

    this.registerEvent(
      this.index.on("renamed", (oldPath, newPath) => {
        if (this.#sourcePath === oldPath) {
          logger.debug(
            "[tracked-entity-renderer(%s): %s] renaming to %s",
            this.kind,
            this.sourcePath,
            newPath,
          );
          this.#sourcePath = newPath;
          // Future optimization: we only need to re-render if the render functions rely on the
          // source path. In practice, I doubt this matters?
          rerender();
        }
      }),
    );

    // The character blocks watch for settings changes, and this makes that possible!
    const watched = this.watchedSettings;
    if (watched == ALL_SETTINGS) {
      this.register(this.plugin.settings.on("change", () => rerender()));
    } else if (watched.size > 0) {
      this.register(
        this.plugin.settings.on("change", ({ key }) => {
          if (watched.has(key)) {
            rerender();
          }
        }),
      );
    }

    this.render();
  }

  render(): void | Promise<void> {
    logger.debug(
      "[tracked-entity-renderer(%s): %s] render",
      this.kind,
      this.sourcePath,
    );

    const result = this.index.get(this.sourcePath);
    if (result == null) {
      return this.renderMissingEntity();
    } else if (result.isLeft()) {
      return this.renderInvalidEntity(result.error);
    } else {
      return this.renderEntity(result.value);
    }
  }

  /** Called to render an entity that is invalid.
   * Override this to provide a different error message.
   */
  protected renderInvalidEntity(error: E): void | Promise<void> {
    // TODO(@cwegrzyn): can I get a kind for the index?
    render(
      html`<article class="error">
        Invalid ${this.kind} at '${this.sourcePath}':
        <pre>
${error.message}
        </pre
        >
      </article>`,
      this.containerEl,
    );
  }

  protected renderMissingEntity(): void | Promise<void> {
    render(
      html`<article class="error">
        Error: no ${this.kind} indexed at path '${this.sourcePath}'
      </article>`,
      this.containerEl,
    );
  }

  /** Called to render a valid entity. */
  abstract renderEntity(entity: T): void | Promise<void>;

  /** Override this to define settings that should trigger a re-render.
   *
   * Return either a set of settings to return or the special symbol TrackedEntityRenderer.ALL_SETTINGS to trigger on all settings.
   * Note that this is currently expected to be contstant.
   */
  get watchedSettings():
    | Set<keyof IronVaultPluginSettings>
    | typeof ALL_SETTINGS {
    return new Set();
  }
}
export const ALL_SETTINGS: unique symbol = Symbol("ALL_SETTINGS");
