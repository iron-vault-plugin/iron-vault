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
    this.removeDiceOverlay();
    const container = document.createElement("div");
    container.id = "iron-vault-dice-box";
    target.appendChild(container);
    this.diceBox = new DiceBox({
      assetPath: "/",
      container: "#iron-vault-dice-box",
      origin: originUrl.toString(),
      gravity: 3,
      scale: Platform.isMobile ? 8 : 6,
      theme: "iv-theme",
    });
  }

  onload(): void {
    logger.trace("DiceOverlay: onload");
    this.assetsReady = ensureAssets(this.plugin);
  }

  onunload(): void {
    this.removeDiceOverlay();
  }

  async init() {
    logger.trace("Waiting for dice box assets to be ready...");
    await this.assetsReady;
    logger.debug("Initializing dice box");
    await this.diceBox.init();
    logger.debug("Dice box initialized.");
  }

  removeDiceOverlay() {
    document.getElementById("iron-vault-dice-box")?.remove();
  }

  async roll(dice: string | string[] | Roll | Roll[]): Promise<RollResult[]> {
    const container = document.getElementById("iron-vault-dice-box");
    container?.classList.toggle("active", true);
    const roll = await this.diceBox.roll(dice);
    const listener = (ev: KeyboardEvent | MouseEvent) => {
      if (ev instanceof KeyboardEvent || ev instanceof MouseEvent) {
        container?.classList.toggle("active", false);
        this.diceBox.clear();
        container?.removeEventListener("click", listener);
        document.removeEventListener("keydown", listener);
        ev.stopPropagation();
        ev.preventDefault();
      }
    };
    document.addEventListener("keydown", listener);
    container?.addEventListener("click", listener);
    return roll;
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
