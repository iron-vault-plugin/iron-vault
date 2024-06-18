import DiceBox, { Roll, RollResult } from "@3d-dice/dice-box";
import { normalizePath } from "obsidian";

import ammo from "@3d-dice/dice-box/dist/assets/ammo/ammo.wasm.wasm";
import defaultModels from "@3d-dice/dice-box/dist/assets/models/default.json";
import diffuseDark from "@3d-dice/dice-box/dist/assets/themes/default/diffuse-dark.png";
import diffuseLight from "@3d-dice/dice-box/dist/assets/themes/default/diffuse-light.png";
import normal from "@3d-dice/dice-box/dist/assets/themes/default/normal.png";
import specular from "@3d-dice/dice-box/dist/assets/themes/default/specular.jpg";

import IronVaultPlugin from "index";

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
      gravity: 6,
      angularDamping: 0.5,
      linearDamping: 0.5,
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
  const allExists = await Promise.all([
    exists("ammo/ammo.wasm.wasm"),
    exists("models/default.json"),
    exists("themes/default/diffuse-dark.png"),
    exists("themes/default/diffuse-light.png"),
    exists("themes/default/normal.png"),
    exists("themes/default/specular.jpg"),
  ]);
  if (!allExists.every((x) => x)) {
    await mkdir("");
    await mkdir("ammo");
    await mkdir("models");
    await mkdir("themes");
    await mkdir("themes/default");
    await Promise.all([
      writeFile("ammo/ammo.wasm.wasm", ammo),
      writeFile("models/default.json", JSON.stringify(defaultModels)),
      writeFile("themes/default/diffuse-dark.png", diffuseDark),
      writeFile("themes/default/diffuse-light.png", diffuseLight),
      writeFile("themes/default/normal.png", normal),
      writeFile("themes/default/specular.jpg", specular),
    ]);
  }
  function mkdir(path: string) {
    const dest = normalizePath(assetsPath + "/" + path);
    return plugin.app.vault.adapter.mkdir(dest);
  }
  function exists(path: string) {
    const dest = normalizePath([assetsPath, path].join("/"));
    return plugin.app.vault.adapter.exists(dest);
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
