import DiceBox, { Roll, RollResult } from "@3d-dice/dice-box";
import { Platform, normalizePath } from "obsidian";

import ammo from "@3d-dice/dice-box/dist/assets/ammo/ammo.wasm.wasm";
import defaultModels from "@3d-dice/dice-box/dist/assets/models/default.json";
import diffuseDark from "@3d-dice/theme-smooth/diffuse-dark.png";
import diffuseLight from "@3d-dice/theme-smooth/diffuse-light.png";
import normal from "@3d-dice/theme-smooth/normal.png";
import smoothDice from "@3d-dice/theme-smooth/smoothDice.json";
import themeConfig from "@3d-dice/theme-smooth/theme.config.json";

import IronVaultPlugin from "index";
import { rootLogger } from "logger";

const logger = rootLogger.getLogger("dice-overlay");

export class DiceOverlay {
  diceBox: DiceBox;

  static async init(plugin: IronVaultPlugin, target: HTMLElement) {
    const od = new DiceOverlay(plugin, target);
    await ensureAssets(plugin);
    await od.diceBox.init();
    return od;
  }

  private constructor(
    public plugin: IronVaultPlugin,
    target: HTMLElement,
  ) {
    const originUrl = new URL(
      plugin.app.vault.adapter.getResourcePath(pluginAssetsPath(plugin)),
    );
    originUrl.search = "";
    this.removeDiceOverlay();
    const container = document.createElement("div");
    container.id = "iron-vault-dice-box";
    target.appendChild(container);
    container.addEventListener("click", () => {
      container.classList.toggle("active", false);
      this.diceBox.clear();
    });
    this.diceBox = new DiceBox("#iron-vault-dice-box", {
      assetPath: "/",
      origin: originUrl.toString(),
      gravity: 3,
      scale: Platform.isMobile ? 8 : 6,
      theme: "iv-theme",
    });
  }

  removeDiceOverlay() {
    document.getElementById("iron-vault-dice-box")?.remove();
  }

  async roll(dice: string | string[] | Roll | Roll[]): Promise<RollResult[]> {
    document
      .getElementById("iron-vault-dice-box")
      ?.classList.toggle("active", true);
    return await this.diceBox.roll(dice);
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
  await mkdir("models");
  await mkdir("themes");
  await mkdir("themes/iv-theme");
  await Promise.all([
    writeFile("ammo/ammo.wasm.wasm", ammo),
    writeFile("models/default.json", JSON.stringify(defaultModels)),
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
