iIron Vault overrides a number of kinds of links to change their behavior: instead of trying to open a link in your browser, they will open a pop window/modal with the entity they link to.

You can use special links using external link syntax (`[Name of Link](type:path/a/b)`), where `type:path/a/b` is one of the following:

* a complete Datasworn ID, as in `[Face Danger](move:starforged/adventure/face_danger)`, `[Read Heart](asset.ability.move:starforged/path/empath.0.read_heart)`, or `[Space Creature Basic Form](oracle_rollable:starforged/creature/basic_form/space)`
* `move:`, `oracle:`, or `asset:` followed by the name of a move, oracle, or asset. The name must have no spaces, but you can capitalize it however you want. For example, `[Face Danger](move:Facedanger)`.

The following Datasworn entity types are clickable:
#### Moves

Clicking on a move link will open a popup window with move details.

Example: `[Face Danger](move:FaceDanger)` or `[Face Danger](move:starforged/adventure/face_danger)` will open a popup window that looks like this:

![[face-danger-link.png]]
#### Oracles

Clicking an Oracle link will open a popup window with the Oracle move table. When referencing by name, you'll need to remove any spaces.

Example: `[Background Assets](oracle_rollable:starforged/campaign_launch/background_assets)` will render as [Background Assets](oracle_rollable:starforged/campaign_launch/background_assets)

![[background-assets-link.png]]
#### Assets

Clicking an asset will open a popup window with a read-only Asset card.

Example: `[Gunslinger](asset:Gunslinger)` will open a popup window that looks like:
![[gunslinger-link.png]]