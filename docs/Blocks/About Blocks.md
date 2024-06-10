"Blocks" are used throughout Iron Vault to provide custom rendering of various game features. Most blocks also provide interactivity, so instead of having to manually edit frontmatter data, you can do the edits through the blocks' rendered views themselves.
You can use them as much or as little as you want, just like any other Iron Vault feature.

All blocks are used by using triple backticks (\`), the name of the block, a new line, then a closing set of triple backticks.

Most blocks don't contain anything in order to work, but some, like [[Mechanics Blocks]], have special contents that determine how they're rendered.

The following blocks are supported:

* [[Asset Blocks]] (`iron-vault-assets`) - inline asset cards (with read-only, no settings).
- [[Character Blocks]] (`iron-vault-character`) - a character sheet, or the more fine-grained versions:
  - `iron-vault-character-info`
  - `iron-vault-character-stats`
  - `iron-vault-character-meters`
  - `iron-vault-character-special-tracks`
  - `iron-vault-character-impacts`
  - `iron-vault-character-assets`
- [[Clock Blocks]] (`iron-vault-clock`) - for tension clock notes
- [[Mechanics Blocks]] (`iron-vault-mechanics`) - fancy drawing of mechanics, intended for use in journal pages.
- [[Moves Blocks]] (`iron-vault-moves`) - searchable list of moves (same thing as the [[Sidebar]], but useful if you want to embed it directly in a note)
- [[Oracles Blocks]] (`iron-vault-oracles`) - searchable list of oracles (same thing as the [[Sidebar]], but useful if you want to embed it directly in a note)
- [[Track Blocks]] (`iron-vault-track`) - for progress track notes
- [[Truth Blocks]] (`iron-vault-truth`) - Shows a picker that lets you generate a particular truth, optionally regenerating it if you want to try again.
