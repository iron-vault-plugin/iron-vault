---
<%*
const api = window.IronVaultAPI;
const nameRoll = api.roll('oracle_rollable:starforged/faction/name/template');
const name = nameRoll.simpleResult;
await tp.file.rename(name)

const factionTypeRoll = api.roll('oracle_rollable:starforged/faction/type');
const faction_type = api.stripLinks(factionTypeRoll.simpleResult);
-%>
name: <% name %>
tags:
  - faction
faction_type: <% faction_type %>
---

# <% name %>

> [!INFO] Faction Attributes
> Name: `= this.name`
> Type: `= this.faction_type`

## Appendix

### Oracle Rolls

<% api.formatOracleBlock({roll: nameRoll, question: "Faction name"}) %>

<% api.formatOracleBlock({roll: factionTypeRoll, question: "Faction type"}) %>
