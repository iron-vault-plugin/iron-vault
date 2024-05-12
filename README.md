# Obsidian Forged

Obsidian plugin to play Ironsworn/Starforged system games, using the data in
[datasworn](https://github.com/rsek/datasworn) format.

This owes a lot to [Eric Bright's Forged_in_Obsidian](https://github.com/ericbright2002/Forged_in_Obsidian)
template vault. I started with that vault and then gradually replaced functionality
with this plugin.

## Using the plugin

I don't yet have good instructions on setting things up-- but you'll basically
want a repository similar to the included `test-vault`.

To build the code and copy it to your vault, put the vault path in a `.targetdir`
file and then run: `pnpm install && pnpm copy:target`

You should then be able to enable the plugin in your vault (after
restarting/reloading Obsidian)

## Development

To play around, you can run `pnpm dev`, which watches for code changes, compiles,
and then deploys into the test vault. You can open up the test-vault in obsidian
and, with the hot-reload plugin enabled, new updates will be loaded automatically.

## Caveats

Biggest caveat is that this is a moving target and the file formats may change.
I have a bunch of stuff in the existing format, so I'm trying to be backwards
compatible.

A bunch of stuff is missing right now:

- I haven't tested with Ironsworn at all-- the Starforged data is bundled right now
  but eventually I'll make it a download?
- Asset meters aren't currently modifiable/rollable (but this is next up)
- Probably a dozen other signficant things I can't think of
