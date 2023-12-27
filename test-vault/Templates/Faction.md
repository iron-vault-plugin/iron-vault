---
<%*
const api = window.ForgedAPI;
const nameRoll = api.roll('starforged/oracles/factions/name/template');
const name = nameRoll.simpleResult;
await tp.file.rename(name)

const factionTypeRoll = api.roll('starforged/oracles/factions/type');
-%>
name: <% name %>
tags:
  - faction
faction_type: <% faction_type %>
---

> [!INFO] Faction Attributes
> Name: `= this.name`

## Appendix

### Oracle Rolls

<% api.formatOracleBlock({roll: nameRoll, question: "Faction name"}) %>
