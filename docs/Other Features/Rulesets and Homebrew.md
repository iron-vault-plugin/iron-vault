Rules packages define a collection of game-specific content and/or rules that fall within the scope of the Ironsworn/Starforged family of games, but with some leeway for variance. For example, rulesets can define Assets, Moves, and Oracles, and even things like Meters and Stats. There are various ways of defining and activating rulesets in Iron Vault.

### Datasworn

Iron Vault relies on the official [Datasworn](https://github.com/rsek/datasworn) library for two key elements:

1. A structure (also known as a _schema_) for representing as data the components of an Ironsworn-based game, such as the moves, assets, and oracles.
2. Official data files using the Datasworn schema for Ironsworn, Ironsworn: Delve, Starforged, and Sundered Isles.

In [Datasworn](https://github.com/rsek/datasworn) parlance, a _rules package_ can be either a base _ruleset_ (such as _Ironsworn_ or _Starforged_) or an _expansion_ (such as _Ironsworn: Delve_) which adds additional content to a base ruleset.

### Built-in Rulesets

Iron Vault is bundled with official [Datasworn](https://github.com/rsek/datasworn) rulesets for Ironsworn and Starforged. You can control the active rulesets via [[Settings#Rulesets]].

(Experimental)

Official support for expansions like Ironsworn: Delve and Sundered Isles is on the roadmap. Right now, we have experimental support for loading expansion content. You can enable the expansions in [[Settings#Rulesets]]. Please note: new mechanics introduced by the expansion may not be implemented fully or correctly at this time. The expansions do not standalone and you are expected to enable the appropriate base game along with the expansion. Iron Vault does not enforce this at this time, but things may not work correctly if you enable an expansion without enabling the appropriate base game.

> [!IMPORTANT] Sundered Isles is in preview.
> The Datasworn Sundered Isles data is considered a preview, awaiting finalization of the Sundered Isles rulebook.
### Homebrew

Iron Vault supports custom homebrew rules packages. In the future, we will add additional mechanisms for easily adding things like oracles, moves, and assets in simpler Markdown format.

#### Datasworn JSON

Custom rules packages can be loaded from JSON files following the [Datasworn](https://github.com/rsek/datasworn) specification. Files must be in a format compatible with the Datasworn 0.1.0 release. For more information on Datasworn versions, see [[Data versions and vault migration]].

To enable this, put your homebrew content in a folder in your vault. In settings, turn on _Enable Homebrew content_ in _Settings_ and set _Homebrew content folder_ to the folder with your content.

Note that, in addition, you might need to enable `Settings > Files and links > Detect all file extensions` in order for .json files to show up in your vault. The file will be there, you just won't see it.
