import ForgedPlugin from "index";
import { MoveModal } from "moves/move-modal";
import { MarkdownRenderChild, MarkdownRenderer } from "obsidian";

export default async function renderForgedMoves(
  cont: Element,
  plugin: ForgedPlugin,
) {
  const loading = cont.createEl("p", { text: "Loading data..." });
  await plugin.datastore.waitForReady;
  loading.remove();
  renderMoveList(cont, plugin);
}

function renderMoveList(cont: Element, plugin: ForgedPlugin) {
  const cats = plugin.datastore.moveCategories;
  const list = cont.createEl("ol", { cls: "move-list" });
  for (const cat of cats.values()) {
    const catEl = list.createEl("li", { cls: "category" });
    const wrapper = catEl.createDiv("wrapper");
    const details = wrapper.createEl("details");
    const summary = details.createEl("summary");
    if (cat.color) {
      summary.style.backgroundColor = cat.color;
    }
    summary.createEl("span", { text: cat.canonical_name ?? cat.name });
    const contents = wrapper.createEl("ol", { cls: "content" });

    for (const move of Object.values(cat.contents ?? {})) {
      const li = contents.createEl("li");
      li.createEl("header", { text: move.name });
      MarkdownRenderer.render(
        plugin.app,
        move.trigger.text,
        li,
        "",
        new MarkdownRenderChild(li),
      );
      // TODO(@zkat): Figure out how to get the right sourcePath here. Will probably need to get the view/editor.
      const modal = new MoveModal(plugin.app, plugin, ".", move);
      li.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        modal.open();
      });
    }
  }
}
