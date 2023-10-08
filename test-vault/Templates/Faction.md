---
<%*
const api = window.ForgedAPI;
const nameRoll = api.datastore.roller.roll('starforged/oracles/factions/name/template');
const name = api.dehydrateRoll(nameRoll).results[0];
await tp.file.rename(name)
-%>
name: <% name %>
---

> [!INFO] Faction Attributes
> Name: `= this.name`


## Appendix

### Oracle Rolls

<% api.formatOracleBlock({roll: nameRoll, question: "Faction name:"}) %>