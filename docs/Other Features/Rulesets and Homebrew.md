Rules packages define a collection of game-specific content and/or rules that fall within the scope of the Ironsworn/Starforged family of games, but with some leeway for variance. For example, rules packages can define Assets, Moves, and Oracles, and even things like Meters and Stats. There are various ways of defining and activating rulesets in Iron Vault.

You select which content is part of your [[Campaigns/index|Campaign]] by configuring your Campaign's [[Campaigns/Playsets/index|index]].

### Datasworn

Iron Vault relies on the official [Datasworn](https://github.com/rsek/datasworn) library for two key elements:

1. A structure (also known as a _schema_) for representing as data the components of an Ironsworn-based game, such as the moves, assets, and oracles.
2. Official data files using the Datasworn schema for Ironsworn, Ironsworn: Delve, Starforged, and Sundered Isles.

In [Datasworn](https://github.com/rsek/datasworn) parlance, a _rules package_ can be either a base _ruleset_ (such as _Ironsworn_ or _Starforged_) or an _expansion_ (such as _Ironsworn: Delve_) which adds additional content to a base ruleset.

### Built-in Rulesets

Iron Vault is bundled with official [Datasworn](https://github.com/rsek/datasworn) rulesets for Ironsworn and Starforged, as well as the Delve and Sundered Isles expansions.

> [!IMPORTANT] Sundered Isles is in preview.
> The Datasworn Sundered Isles data is considered a preview, awaiting finalization of the Sundered Isles rulebook.

### Homebrew

Iron Vault supports custom homebrew rules packages. You can provide these packages in two formats:

1. [[Rulesets and Homebrew#Compiled Datasworn JSON|Compiled Datasworn JSON]]: pre-compiled Datasworn json files can be dropped directly in the Homebrew folder as a complete package
2. [[Rulesets and Homebrew#Custom Source Folders|Custom Source Folders]]: you can also build Datasworn packages from a mixture of Datasworn "source" YAML and Markdown files in a custom Iron Vault format

#### Compiled Datasworn JSON

Custom rules packages can be loaded from JSON files following the [Datasworn](https://github.com/rsek/datasworn) specification. Files must be in a format compatible with the Datasworn 0.1.0 release. For more information on Datasworn versions, see [[Data versions and vault migration]].

To enable this, put your homebrew content in a folder in your vault. In settings, turn on _Enable Homebrew content_ in _Settings_ and set _Homebrew content folder_ to the folder with your content.

Note that, in addition, you might need to enable `Settings > Files and links > Detect all file extensions` in order for .json files to show up in your vault. The file will be there, you just won't see it.

#### Custom Source Folders (experimental)

Iron Vault bundles the Datasworn compiler-- with some enhancements-- allowing you to compose homebrew content from files in a variety of formats.

Iron Vault will attempt to compile each subfolder of your Homebrew directory as a custom Datasworn package, using the folder name as the package id.
##### Using custom content

To use such a package, you'll need to make sure it is included in your campaign's playset. For example, if you have a folder `Homebrew/mycontent`, you'll want to make sure your playset has a line like `*:mycontent/**` to ensure that all of your custom content is available.

In this experimental release, you will not see changes to your content immediately reflected in Iron Vault. To recompile and reload your content, use the `Reload homebrew and datasworn data` command (or reload your vault).
##### Creating custom content

We support three kinds of files, currently:

* Datasworn Source rules packages YAML files (type: `ruleset` or `expansion`)
* Datasworn Source standalone entry YAML files (type: `move` or `asset` or `oracle_rollable`)
* IronVault Markdown `inline-oracle` files

Datasworn Source rules package YAML files can be placed anywhere in the tree, and they are merged, unmodified, into the final source passed into the Datasworn compiler. This matches the behavior of the official Datasworn source data structure in the <https://github.com/rsek/datasworn>, and so you can always use those files as models for structuring your content.

Other file types must be organized into folders, and Iron Vault will build Datasworn collections from the contained files, using the folder structure to generate IDs. A folder must contain content of the same type (e.g., you cannot put moves and oracles in the same folder).

For example, imagine you have this structure:

* Homebrew
	* mycontent
		* Campaign
			* My Campaign Oracle.md (An IronVault markdown `inline-oracle`)
			* My Other Campaign Oracle.yaml (A Datasworn `oracle_rollable` file)
		* mymoves
			* learn_from_your_failures.yaml (A Datasworn `move` YAML file)

Assuming these files are all correctly formatted, this will lead to the creation of the following Datasworn entities:

* `oracle_collection:mycontent/campaign`: An Oracle Collection named "Campaign" that contains the oracles:
	* `oracle_rollable:mycontent/campaign/my_campaign_oracle`: An oracle table parsed from a markdown file
	* `oracle_rollable:mycontent/campaign/my_other_campaign_oracle`: An oracle table parsed from a Datasworn Source file
* `move_category:mycontent/mymoves`: A Move Category named `mymoves`
	* `move:mycontent/mymoves/learn_from_your_failures`: A move parsed from the Datasworn Source file
##### Collection (folder) index files

Let's suppose that you wanted to change the display name of the `mymoves` category and provide a value for the Datasworn `MoveCategory` `summary` field. In the `mymoves` folder, you can create a file `_index.md` (in this example, the full path would be `Homebrew/mycontent/mymoves/_index.md`) that looks like the following:

```
---
name: My Awesome Moves
summary: A set of really awesome custom moves I made for my campaign
---
```

Any frontmatter properties in that file will be directly added to the Datasworn Source collection object generated for the folder.

Instead of an `_index.md` file, you may use an `_index.yaml` file. Any top-level fields will be merged into the collection object.
##### Markdown oracle files

To make it easier to create Oracles, Iron Vault supports a straightforward Markdown format for creating oracles. Here's an example Oracle Markdown file:

```
---
type: oracle_rollable
description: Here is a description of my oracle.
---

| dice: 1d6 | Result                                               |
| --------- | ---------------------------------------------------- |
| 1-2       | [Action](oracle_rollable:sundered_isles/core/action) |
| 3-5       | [Theme](oracle_rollable:sundered_isles/core/theme)   |
| 6         | Just foo                                             |
```

Frontmatter:

* The `type` frontmatter property *must* say `oracle_rollable`. That's how Iron Vault knows you want this to be parsed as an Oracle file.
* All other frontmatter properties will be add to the Datasworn Source `OracleRollable` object as-is.
* By default, the `name` will be the name of the file; you may override this by providing a `name` property in the frontmatter.

The oracle itself is provided in table format. The first column indicates the dice to roll (in this case, `1d6`), and the second column is the result. Dice rolls can be provided either as a range (`3-5`) or a single value (`6`). Iron Vault does not currently validate that the values cover the entire range or are non-overlapping, and behavior in either case is unspecified.

As shown in the example, your results may embed references to other oracles. These will be embedded as subrolls when the Oracle is used. Among other things, this can be used to create templates (such as for faction names), where a result is composed of several other rolls.

You can also combine multiple dice as though they were "digits" by separating the digits in the dice and range expressions with a semi colon. For example, to roll what is sometimes called a "d66" table, you can use a table like this:

```
| dice: 1d6;1d6 | Result |
| ------------- | ------ |
| 1;1-2         | A      |
| 1;3-6         | B      |
| 2;1-3         | C      |
| 2;4-6         | D      |
| 3-6;1         | E      |
| 3-6;4-6       | F      |
```

Iron Vault will convert this to a d36 table with the appropriate rows. Note that `3-6;1` will "flatten" to non-contiguous values (`13`, `19`, `25`, `31`), and those rows will be repeated in the flattened oracle table.