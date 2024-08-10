---
title: About Iron Vault
---
![[iron-vault-screenshot.png]]

This is the documentation for [Iron Vault](https://github.com/iron-vault-plugin/iron-vault), a plugin for [Obsidian](https://obsidian.md) that turns the beloved note-taking/journaling tool into a full-fledged Virtual Tabletop (VTT) for the [Ironsworn/Starforged family of games](https://ironswornrpg.com).

It has features ranging from a full character sheet, to commands for making moves, and even an entire featureset for rendering pretty mechanics blocks in your story journals describing the mechanics involved in your story, as they happen. You can even house multiple campaigns in the same vault!

The plugin is designed to be used piecemeal: you can use as much or as little as you want, and our only hope is that some part of it will be useful enough to make you enjoy your experience a little more.

It is not a "play for me"-style VTT, in the sense that while it has a lot of conveniences for rendering and interacting with mechanics, the actual resolution and logic of game mechanics is left up to you, and whatever flexibility you want to handle the game's rules with. The game, after all, is not a single monolithic set of laws, and everyone tends to take their own liberties with the rules in the interest of enjoying the game more.

### Getting Started

Not sure where to start? There's a full [[Player's Guide/index|Player's Guide]] or, more specifically, a [[01 - Initial Setup|Getting Started]] guide so you can jump right in with a new or existing campaign, using as much or as little of Iron Vault as you want!

You can also open this documentation at any time while in Obsidian by running the [[Open documentation in a tab]] or [[Open documentation in your browser]] commands.

### Features

You can start reading about the various Iron Vault features here:

* [[Campaigns/index]] - All functionality in Iron Vault is centered on a *campaign*-- which includes all of the game entities, such as player characters, that are part of the game.
* [[Rulesets and Homebrew#Built-in Rulesets|Built-in Official Rulesets]] - Includes support for Ironsworn Classic, Ironsworn: Delve, Ironsworn: Starforged, and Sundered Isles.
* [[Blocks/index|Blocks]] - Special blocks used throughout the tool to render things nicely and give you handy interactive widgets for editing game data.
* [[Commands/index|Commands]] - Various Obsidian commands, all of which can be bound to hotkeys or the quick access bar, for performing all sorts of game actions, like making moves, creating progress tracks, etc.
* [[Entities/index|Entities]] - How Iron Vault represents all sorts of different game concepts, or some ways that you might choose to represent them yourself.
* [[Campaigns/index|Multiple Campaigns]] - You can have one or more campaigns in a single vault!
* [[Multiplayer]] - Play online or locally with other players!
* [[Sidebar]] - A handy right-panel sidebar for quick access to Moves, Oracles, and your Character Sheet, all in one, easy-access place. Particularly useful on mobile.
* [[Special Links]] - There are special external links that, instead of trying to open a web page, will open a modal window with the contents of the thing you're trying to link to. For example, `[My Move](move:MyMoveName)` will pop up a window with the description and roll buttons for "My Move".
* [[CSS Tweaks]] - Styling tweaks to make some things look nicer or more customized, such as the `iron-vault-embed` option for inlining embeds.
* [[Callouts]] - Special formatting and generation for game-related callouts.
* [[Rulesets and Homebrew#Homebrew|Homebrew]] - BYO Rulesets! Import custom assets, oracles, or even entire rulesets/games that conform to the [Datasworn](https://github.com/rsek/datasworn) data model.
* [[Settings]] - Various configurations available to tweak your Iron Vault experience.
* [[API]] - (Coming Soon) Are you a developer? We expose the plugin for easy access, for folks who want to do fancier things with Iron Vault features.

#### Installing the Plugin

The easiest way to install Iron Vault is directly through the Community Plugins registry in Obsidian itself. Simply search for "Iron Vault", click "install", then "enable", and you're good to go!

You can also install it via [BRAT](https://tfthacker.com/brat-plugins). You should be able to add `iron-vault-plugin/iron-vault` to BRAT, and it will install the latest beta release of this plugin.

You can also install it manually by downloading the latest files from [Github Release](https://github.com/iron-vault-plugin/iron-vault/releases/latest). You'll want to put `main.js`, `manifest.json`, and `styles.css` in `your-vault/.obsidian/plugins/iron-vault`.

To build the code and copy it to your vault yourself, run `pnpm build` to generate the production files, which will be in the repo root. You can then copy these to the location above.

You should then be able to enable the plugin in your vault (after restarting/reloading Obsidian).

#### Contributing

Iron Vault is a community project built by players, for players, and we welcome contributions! Please see [CONTRIBUTING.md](https://github.com/iron-vault-plugin/iron-vault/blob/main/README.md) for details.