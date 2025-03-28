import DiceBox, { Roll, RollResult } from "@3d-dice/dice-box";
import { Component, Platform, normalizePath } from "obsidian";

import ammo from "@3d-dice/dice-box/dist/assets/ammo/ammo.wasm.wasm";
import defaultModels from "@3d-dice/dice-box/dist/assets/themes/default/default.json";
import diffuseDark from "@3d-dice/theme-smooth/diffuse-dark.png";
import diffuseLight from "@3d-dice/theme-smooth/diffuse-light.png";
import normal from "@3d-dice/theme-smooth/normal.png";
import smoothDice from "@3d-dice/theme-smooth/smoothDice.json";
import themeConfig from "@3d-dice/theme-smooth/theme.config.json";

import IronVaultPlugin from "index";
import { rootLogger } from "logger";

const logger = rootLogger.getLogger("dice-overlay");

export class DiceOverlay extends Component {
  diceBox: DiceBox;
  containerEl: HTMLElement;

  assetsReady!: Promise<void>;

  constructor(
    public plugin: IronVaultPlugin,
    target: HTMLElement,
  ) {
    logger.trace("DiceOverlay: constructor");
    super();
    const originUrl = new URL(
      plugin.app.vault.adapter.getResourcePath(pluginAssetsPath(plugin)),
    );
    originUrl.search = "";
    this.#removeDiceOverlay();
    this.containerEl = document.createElement("div");
    this.containerEl.id = "iron-vault-dice-box";
    this.containerEl.createDiv({
      attr: { id: "iron-vault-dice-notice" },
      cls: "notice-container",
    });
    target.appendChild(this.containerEl);
    this.diceBox = new DiceBox({
      assetPath: "/",
      container: "#iron-vault-dice-box",
      origin: originUrl.toString(),
      gravity: 3,
      scale: Platform.isMobile ? 8 : 6,
      theme: "iv-theme",
      onRollComplete: (_rolls: RollResult[]) => {
        if (this.plugin.settings.diceHideAfterSecs > 0) {
          setTimeout(
            this.clear.bind(this),
            this.plugin.settings.diceHideAfterSecs * 1000,
          );
        }
      },
    });
  }

  onload(): void {
    logger.trace("DiceOverlay: onload");
    this.assetsReady = ensureAssets(this.plugin);
  }

  onunload(): void {
    this.#removeDiceOverlay();
  }

  async init() {
    logger.trace("Waiting for dice box assets to be ready...");
    await this.assetsReady;
    logger.debug("Initializing dice box");
    await this.diceBox.init();
    logger.debug("Dice box initialized.");
  }

  #removeDiceOverlay() {
    this.clear();
    document.getElementById("iron-vault-dice-box")?.remove();
  }

  async roll(dice: string | string[] | Roll | Roll[]): Promise<RollResult[]> {
    this.containerEl.classList.toggle("active", true);
    // Enable capture while the dice are rolling
    this.containerEl.classList.toggle("capturing", true);
    const roll = await this.diceBox.roll(dice);
    this.containerEl.classList.toggle(
      "capturing",
      !this.plugin.settings.diceAllowClickthrough,
    );
    // We listen on the document capture phase so that we can catch all
    // clicks and keypresses and reliably remove the overlay.
    document.addEventListener("keydown", this.#listener, { capture: true });
    document.addEventListener("click", this.#listener, { capture: true });

    return roll;
  }

  #listener = (ev: KeyboardEvent | MouseEvent) => {
    if (ev instanceof KeyboardEvent || ev instanceof MouseEvent) {
      // if (!this.plugin.settings.diceAllowClickthrough) {
      //   ev.stopPropagation();
      //   ev.preventDefault();
      // }
      this.clear();
    }
  };

  clear() {
    this.containerEl?.classList.toggle("active", false);
    this.diceBox?.clear();
    document.removeEventListener("click", this.#listener, {
      capture: true,
    });
    document.removeEventListener("keydown", this.#listener, { capture: true });
    document.getElementById("iron-vault-dice-notice")?.empty();
  }

  setMessage(msg: string) {
    const container = document.getElementById("iron-vault-dice-notice");
    container?.empty();
    container?.createDiv({
      text: msg,
      cls: "notice",
    });
  }
}

function pluginAssetsPath(plugin: IronVaultPlugin) {
  return normalizePath(
    [
      plugin.app.vault.configDir,
      "plugins",
      plugin.manifest.id,
      "assets",
      "dice-box",
    ].join("/"),
  );
}

async function ensureAssets(plugin: IronVaultPlugin) {
  const assetsPath = pluginAssetsPath(plugin);
  try {
    await plugin.app.vault.adapter.rmdir(assetsPath, true);
  } catch (e) {
    logger.error("Failed to remove existing assets", e);
  }
  await mkdir("");
  await mkdir("ammo");
  await mkdir("themes");
  await mkdir("themes/default");
  await mkdir("themes/iv-theme");
  await Promise.all([
    writeFile("ammo/ammo.wasm.wasm", ammo),
    writeFile("themes/default/default.json", JSON.stringify(defaultModels)),
    writeFile("themes/iv-theme/diffuse-dark.png", diffuseDark),
    writeFile("themes/iv-theme/diffuse-light.png", diffuseLight),
    writeFile("themes/iv-theme/normal.png", normal),
    writeFile("themes/iv-theme/smoothDice.json", JSON.stringify(smoothDice)),
    writeFile("themes/iv-theme/theme.config.json", JSON.stringify(themeConfig)),
  ]);
  function mkdir(path: string) {
    const dest = normalizePath(assetsPath + "/" + path);
    return plugin.app.vault.adapter.mkdir(dest);
  }
  function writeFile(path: string, data: Uint8Array | string) {
    const dest = normalizePath([assetsPath, path].join("/"));
    if (typeof data === "string") {
      return plugin.app.vault.adapter.write(dest, data);
    } else {
      return plugin.app.vault.adapter.writeBinary(dest, data.buffer);
    }
  }
}
