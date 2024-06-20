Assets in Ironsworn/Starforged are a core mechanic for building up a character's "class" and their "inventory", of sorts. It's a fairly open-ended system that allows for interesting combinations, and it's also the core progression system of the game, where you grow your character not by upgrading their stats, but by buying new assets with XP and upgrading ones you already have.

Iron Vault directly supports assets in a number of ways.

#### Asset Cards

Assets in most places in Iron Vault are represented as asset cards. These cards are shown in a number of places, including popup windows and your character sheet. They are only editable in the character sheet itself; otherwise, they will be shown as a read-only example:

```iron-vault-asset
Starship
```
#### Adding, Removing, and Editing Assets

You can add assets to your character two different ways:

1. Using the [[Add asset to character]] command.
2. Click on the `Add Asset` button in the [[Character Blocks|Character Sheet]]

Both of these methods will add the asset directly to your character sheet. The first method will also add a [[Mechanics Blocks#`asset`|mechanics block `asset` node]] to your journal denoting that an asset was added.

Once you have an asset in your character sheet, you can remove it by clicking the "x" button on the top right of the asset.

You can also reorder assets by going to your character sheet's asset section and click-dragging the top section of the asset card then dropping it in the spot you want it to move to.

When in your character sheet, you can edit all option fields of your assets, such as a name if the asset calls for one, or picking an associated stat. You can also mark of unmark abilities by clicking on the hexagon next to them.
#### Asset Links

You can link to an asset's definition card using [[Special Links#`asset `|`asset:` links]]. When clicked, these links will open a popup window with a read-only, default version of the asset for reference.

#### Asset Blocks

You can embed an asset's read-only card using [[Asset Blocks]]. These blocks will not be associated with your character's assets and are only for reference of the original asset definition.

#### Custom Assets

(Coming Soon)

In the future, Iron Vault will support custom [[Rulesets and homebrew]], including individual homebrew assets.