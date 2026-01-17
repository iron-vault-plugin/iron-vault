/**
 * Oracle inline renderer.
 */

import IronVaultPlugin from "index";
import { setIcon } from "obsidian";
import { OracleModal } from "oracles/oracle-modal";
import { ParsedInlineOracle } from "../syntax";
import { createContainer, setTooltip } from "./shared";

/**
 * Render an inline oracle result.
 */
export function renderInlineOracle(
  parsed: ParsedInlineOracle,
  plugin: IronVaultPlugin,
): HTMLSpanElement {
  const container = createContainer("oracle");

  // Oracle icon
  const iconEl = createSpan({ cls: "iv-inline-oracle-icon" });
  setIcon(iconEl, "sparkles");
  container.appendChild(iconEl);

  // Oracle name (clickable if we have an oracleId - always opens modal)
  const nameEl = createSpan({
    cls: "iv-inline-oracle-name",
    text: parsed.name + ":",
  });
  if (parsed.oracleId) {
    nameEl.addClass("iv-inline-link");
    nameEl.setAttribute("data-oracle-id", parsed.oracleId);
    nameEl.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const oracle = plugin.datastore.dataContext.oracles.get(parsed.oracleId!);
      if (oracle) {
        new OracleModal(plugin.app, plugin, oracle).open();
      }
    });
  }
  container.appendChild(nameEl);

  // Result
  container.appendChild(
    createSpan({ cls: "iv-inline-oracle-result", text: parsed.result }),
  );

  // Cursed die if present
  if (parsed.cursedRoll != null) {
    const cursedEl = createSpan({ cls: "iv-inline-cursed" });
    const cursedIconEl = createSpan({ cls: "iv-inline-cursed-icon" });
    setIcon(cursedIconEl, "skull");
    cursedEl.appendChild(cursedIconEl);
    cursedEl.appendChild(createSpan({ text: `${parsed.cursedRoll}` }));
    container.appendChild(cursedEl);
  }

  // Tooltip with roll details
  let tooltipText = `Roll: ${parsed.roll}`;
  if (parsed.cursedRoll != null) {
    tooltipText += ` | Cursed: ${parsed.cursedRoll}`;
  }
  setTooltip(container, tooltipText);

  return container;
}
