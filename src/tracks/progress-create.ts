import {
  App,
  FuzzyMatch,
  Modal,
  Setting,
  TextComponent,
  prepareFuzzySearch,
} from "obsidian";
import { generateObsidianFilename } from "utils/filename";
import { processMatches } from "../utils/suggest";
import { TextInputSuggest } from "../utils/ui/suggest";
import { ChallengeRanks, ProgressTrack } from "./progress";

class GenericTextSuggest extends TextInputSuggest<FuzzyMatch<string>> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    public readonly items: string[],
  ) {
    super(app, inputEl);
  }
  getSuggestions(inputStr: string): FuzzyMatch<string>[] {
    const searchFn = prepareFuzzySearch(inputStr);
    return this.items
      .flatMap((item) => {
        const match = searchFn(item);
        if (match) {
          return [{ item, match }];
        } else {
          return [];
        }
      })
      .sort((a, b) => a.match.score - b.match.score);
  }
  renderSuggestion({ item, match }: FuzzyMatch<string>, el: HTMLElement): void {
    if (item == null) return;

    el.createDiv(undefined, (div) => {
      processMatches(
        item,
        match,
        (text) => {
          div.appendText(text);
        },
        (text) => {
          div.createEl("strong", { text });
        },
      );
    });
    // if (renderExtras != null) {
    //   renderExtras(match, el);
    // }
  }
  selectSuggestion({ item }: FuzzyMatch<string>): void {
    this.inputEl.value = item;
    this.inputEl.trigger("input");
    this.close();
  }
}

export class ProgressTrackCreateModal extends Modal {
  public result = {
    rank: ChallengeRanks.Dangerous,
    progress: 0,
    name: "",
    tracktype: "",
    fileName: "",
  };

  public accepted: boolean = false;

  constructor(
    app: App,
    protected readonly onAccept: (arg: {
      name: string;
      tracktype: string;
      fileName: string;
      track: ProgressTrack;
    }) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    new Setting(contentEl).setName("New Progress Track").setHeading();

    let fileNameText: TextComponent;

    new Setting(contentEl).setName("Name").addText((text) =>
      text.onChange((value) => {
        this.result.name = value;
        // TODO: could add smarter logic to only update if user hasn't made a specific value
        fileNameText.setValue(generateObsidianFilename(value)).onChanged();
      }),
    );

    new Setting(contentEl).setName("File name").addText(
      (text) =>
        (fileNameText = text.onChange((value) => {
          this.result.fileName = value;
        })),
    );

    // TODO: since the string value equals the display string, i don't actually know if this
    //   is working as intended with the options
    new Setting(contentEl).setName("Rank").addDropdown((dropdown) =>
      dropdown
        .addOptions(ChallengeRanks)
        .onChange((value) => {
          this.result.rank = value as ChallengeRanks;
        })
        .setValue(this.result.rank),
    );

    new Setting(contentEl).setName("Type").addSearch((search) => {
      search.setPlaceholder(
        "What kind of track is this? (e.g., Vow, Connection)",
      );

      new GenericTextSuggest(this.app, search.inputEl, [
        "Vow",
        "Connection",
        "Combat",
        "Scene Challenge",
        "Expedition",
      ]);

      search.onChange((value) => {
        this.result.tracktype = value;
      });
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Create")
          .setCta()
          .onClick(() => {
            this.accept();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.accepted = false;
          this.close();
        }),
      );
  }

  accept(): void {
    this.accepted = true;
    this.close();
    this.onAccept({
      name: this.result.name,
      tracktype: this.result.tracktype,
      fileName: this.result.fileName,
      track: ProgressTrack.create_({
        rank: this.result.rank,
        progress: this.result.progress,
        complete: false,
        unbounded: false,
      }),
    });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
