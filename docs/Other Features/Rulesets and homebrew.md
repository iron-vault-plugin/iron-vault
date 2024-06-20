Rules packages define a collection of game-specific content and/or rules that fall within the scope of the Ironsworn/Starforged family of games, but with some leeway for variance. For example, rulesets can define Assets, Moves, and Oracles, and even things like Meters and Stats. There are various ways of defining and activating rulesets in Iron Vault.

In [Datasworn](https://github.com/rsek/datasworn) parlance, a *rules package* can be either a base *ruleset* (such as *Ironsworn* or *Starforged*) or an *expansion* (such as *Ironsworn: Delve*) which adds additional content to a base ruleset.
#### Built-in Rulesets

Iron Vault is bundled with official [Datasworn](https://github.com/rsek/datasworn) rulesets for Ironsworn and Starforged. You can control the active rulesets via [[Settings#Rulesets]].

(Coming Soon)

Support for expansions like Ironsworn: Delve and Sundered Isles is on the roadmap.

#### Homebrew

Iron Vault supports custom homebrew rules packages. In the future, we will add additional mechanisms for easily adding things like oracles, moves, and assets in simpler Markdown format.
##### Datasworn JSON

Custom rules packages can be loaded from JSON files following the [Datasworn](https://github.com/rsek/datasworn) specification.

To enable this, 