Character blocks are intended to be used in dedicated character notes with specially-formatted frontmatter. They render a full-featured character sheet that lets you see and manage your character.

They look like this:
![[character-sheet.png]]

[[Characters|Characters]] in Iron Vault are [[Entities/index|Entities]], and can only have one note per character, since their data is stored in frontmatter. These characters can be placed anywhere as long as they have the right metadata.

Currently, Iron Vault only supports one character per Obsidian vault, but multi-character and multi-campaign mode is on the roadmap.

### Setting up your character

You can create a new character using the [[Create new character]]. It will take care of creating a new note with all the [[Characters#schema|required metadata]], and it will add a `iron-vault-character` block automatically for you, which will take care of rendering the full character sheet.

From here on, you can edit your note however you please to add more details about your character, a portrait, etc.
#### Example

````
---
...valid character metadata...
---

```iron-vault-character
```

#### About

Ash Barlowe is a great adventurer but also a rascal.
````

#### Sub-blocks
If you want more control over how your character sheet is rendered, you can choose to use sub-blocks instead of the big single-block character sheet. You can remove the main character sheet simply by deleting the block (the thing with the backticks).

The following sub-blocks are available, each corresponding to a section of the full character sheet:

* `iron-vault-character-info` - name, callsign, description, XP earned, XP spent
* `iron-vault-character-stats` - your character stats (edge, heart, etc)
* `iron-vault-character-meters` - your character meters (health, spirit, etc, as well as momentum)
* `iron-vault-character-special-tracks` - your special progress tracks (legacy tracks like quests, bonds, etc)
* `iron-vault-character-impacts` - impacts/debilities (wounded, doomed, etc)
* `iron-vault-character-assets` - asset cards for your current character assets and their filled-out fields.

You could, for example, use this to add headings before each section, or do the following to put your legacy tracks and your [Delve Failure track](https://www.ironswornrpg.com/post/learn-from-failures-in-starforged) in the same place:

````
### Special Tracks

```iron-vault-character-special-tracks
```
![[Failure]]
````

Will render the following:

![[special-tracks-example.png]]