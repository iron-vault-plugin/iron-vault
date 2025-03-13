import { Modal, Setting } from "obsidian";

import { type App } from "obsidian";

/** Modal to render an informative prompt to the user. */
export class InfoModal extends Modal {
  static async show(
    app: App,
    content: string | DocumentFragment | HTMLElement,
  ): Promise<void> {
    if (content instanceof HTMLElement) {
      const fragment = document.createDocumentFragment();
      fragment.appendChild(content);
      content = fragment;
    }
    return await new Promise((resolve, _reject) => {
      new this(app, content, resolve).open();
    });
  }

  private constructor(
    app: App,
    public readonly content: string | DocumentFragment,
    public readonly accept: () => void,
  ) {
    super(app);
    this.setContent(content);
    new Setting(this.contentEl).addButton((button) => {
      button
        .setCta()
        .setButtonText("Okay")
        .onClick(() => {
          this.close();
        });
    });
  }

  onClose(): void {
    super.onClose();
    this.accept();
  }
}
