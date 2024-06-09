# Iron Vault

Obsidian plugin to play Ironsworn/Starforged system games, using the data in
[datasworn](https://github.com/rsek/datasworn) format.

This owes a lot to [Eric Bright's
Forged_in_Obsidian](https://github.com/ericbright2002/Forged_in_Obsidian)
template vault. I started with that vault and then gradually replaced
functionality with this plugin.

## Documentation

The full documentation is available on the docs site at
https://iron-vault-plugin.github.io/iron-vault/. It covers all current (and some
future!) features of the plugin, how to use them, and even lets you search to
find what you're looking for.

## Features

You can start reading about the various Iron Vault features here:

* [Blocks](https://iron-vault-plugin.github.io/iron-vault/blocks/about-blocks.html) -
  Special blocks used throughout the tool to render things nicely and give you
  handy interactive widgets for editing game data.
* [Commands](https://iron-vault-plugin.github.io/iron-vault/commands/about-commands.html) -
  Various Obsidian commands, all of which can be bound to hotkeys or the
  quick access bar, for performing all sorts of game actions, like making
  moves, creating progress tracks, etc.
* [Entities](https://iron-vault-plugin.github.io/iron-vault/entities/about-entities.html) -
  How Iron Vault represents all sorts of different game concepts, or some
  ways that you might choose to represent them yourself.
* [Sidebar](https://iron-vault-plugin.github.io/iron-vault/other-features/sidebar.html) -
  A handy right-panel sidebar for quick access to Moves, Oracles, and your
  Character Sheet, all in one, easy-access place. Particularly useful on
  mobile.
* [Special
  Links](https://iron-vault-plugin.github.io/iron-vault/other-features/special-links.html) -
  There are `oracle:`, `move:`, `asset:` and `id:` links that, instead of
  trying to open a web page, will instead open a modal window with the
  contents of the thing you're trying to link to. For example, `[My
  Oracle](oracle:MyOracleName)` will pop up a window with the description and
  roll table for "My Oracle".
* [CSS
  Tweaks](https://iron-vault-plugin.github.io/iron-vault/other-features/css-tweaks.html) -
  Styling tweaks to make some things look nicer or more customized, such as
  the `iron-vault-embed` option for inlining embeds.
* [Settings](https://iron-vault-plugin.github.io/iron-vault/other-features/settings.html) -
  Various configurations available to tweak your Iron Vault experience.
* [API](https://iron-vault-plugin.github.io/iron-vault/other-features/api.html) -
  (Coming Soon) Are you a developer? We expose the plugin for easy access, for
  folks who want to do fancier things with Iron Vault features.
* [Rulesets](https://iron-vault-plugin.github.io/iron-vault/other-features/rulesets.html)
  (Coming Soon) - BYO Rulesets! Import custom assets, oracles, or even entire
  rulesets/games that conform to the
  [Datasworn](https://github.com/rsek/datasworn) data model.

## Installing the plugin

For now, the easiest way to install is via
[BRAT](https://tfthacker.com/brat-plugins). You should be able to add this
repo to BRAT, and it will install the latest release of this plugin

You can also install it manually by downloading the latest files from [Github
Release](https://github.com/iron-vault-plugin/iron-vault/releases/latest). You'll want
to put `main.js`, `manifest.json`, and `styles.css` in
`your-vault/.obsidian/plugins/iron-vault`.

To build the code and copy it to your vault yourself, run `pnpm build` to
generate the production files, which will be in the repo root. You can then
copy these to the location above.

You should then be able to enable the plugin in your vault (after
restarting/reloading Obsidian).

## Contributing

Iron Vault is a community project built by players, for players, and we
welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for
details.
