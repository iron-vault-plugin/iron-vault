import { Modal, Setting } from "obsidian";

import { type App } from "obsidian";

/** Modal to render an informative prompt to the user. */
export class InfoModal extends Modal {
  static async show(app: App, content: string): Promise<void> {
    return await new Promise((resolve, _reject) => {
      new this(app, content, resolve).open();
    });
  }

  private constructor(
    app: App,
    public readonly content: string,
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
