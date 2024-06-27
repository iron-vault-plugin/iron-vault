import { App } from "obsidian";
import { CustomSuggestModal } from "utils/suggest";

export const YesNoPrompt = {
  show(app: App, prompt: string): Promise<boolean> {
    return CustomSuggestModal.select(
      app,
      [false, true],
      (val) => (val ? "Yes" : "No"),
      undefined,
      prompt,
    );
  },
};
