Rules packages define a collection of game-specific content and/or rules that fall within the scope of the Ironsworn/Starforged family of games, but with some leeway for variance. For example, rulesets can define Assets, Moves, and Oracles, and even things like Meters and Stats. There are various ways of defining and activating rulesets in Iron Vault.

In [Datasworn](https://github.com/rsek/datasworn) parlance, a _rules package_ can be either a base _ruleset_ (such as _Ironsworn_ or _Starforged_) or an _expansion_ (such as _Ironsworn: Delve_) which adds additional content to a base ruleset.

#### Built-in Rulesets

Iron Vault is bundled with official [Datasworn](https://github.com/rsek/datasworn) rulesets for Ironsworn and Starforged. You can control the active rulesets via [[Settings#Rulesets]].

(Coming Soon)

Support for expansions like Ironsworn: Delve and Sundered Isles is on the roadmap.

#### Homebrew

Iron Vault supports custom homebrew rules packages. In the future, we will add additional mechanisms for easily adding things like oracles, moves, and assets in simpler Markdown format.

##### Datasworn JSON

Custom rules packages can be loaded from JSON files following the [Datasworn](https://github.com/rsek/datasworn) specification.

To enable this, put your homebrew content in a folder in your vault. In settings, turn on _Enable Homebrew content_ in _Settings_ and set _Homebrew content folder_ to the folder with your content.
