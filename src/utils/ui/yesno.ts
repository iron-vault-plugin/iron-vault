import { App, Modal, Setting } from "obsidian";
import { CustomSuggestModal } from "utils/suggest";

export const YesNoPrompt = {
  asSuggest(app: App, prompt: string): Promise<boolean> {
    return CustomSuggestModal.select(
      app,
      [false, true],
      (val) => (val ? "Yes" : "No"),
      undefined,
      prompt,
    );
  },

  show(app: App, prompt: string, title?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        new YesNoModal(app, prompt, resolve, title).open();
      } catch (e) {
        reject(e);
      }
    });
  },
};

class YesNoModal extends Modal {
  protected choice: boolean = false;

  constructor(
    app: App,
    protected readonly prompt: string | DocumentFragment,
    private readonly resolve: (choice: boolean) => void,
    protected readonly title?: string,
  ) {
    super(app);
    if (title) this.setTitle(title);
  }

  onOpen(): void {
    this.contentEl.createDiv({ text: this.prompt });
    const buttonsContainer = this.contentEl.createDiv();
    new Setting(buttonsContainer)
      .addButton((btn) =>
        btn
          .setCta()
          .setButtonText("Yes")
          .onClick(() => this.choose(true)),
      )
      .addButton((btn) =>
        btn.setButtonText("No").onClick(() => this.choose(false)),
      );
  }

  choose(choice: boolean) {
    this.choice = choice;
    this.close();
  }

  onClose(): void {
    this.resolve(this.choice);
  }
}
