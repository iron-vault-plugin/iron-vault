Iron Vault overrides a number of kinds of links to change their behavior: instead of trying to open a link in your browser, they will open a pop window/modal with the entity they link to.

You can use special links using external link syntax (`[Name of Link](id:something/goes/here)`), along with the related link type identifier, and then the entity identifier.

Link paths (the part after the `:`) must have no spaces, but can be capitalized any way you want. They are case-insensitive.
#### `id:`

`id:` links can be used to refer to any game entity by their unique Datasworn identifier. It will open a different popup depending on what kind of entity the identifier refers too.

Example: `[Face Danger](id:starforged/moves/adventure/face_danger)` will render as [Face Danger](id:starforged/moves/adventure/face_danger)
#### `move:`

`move:` links can be used to refer to any move by either its unique Datasworn identifier, or by its full name. It will open a popup window with move details. When referencing by name, you'll need to remove any spaces.

Example: `[Face Danger](move:FaceDanger)` will render as [Face Danger](move:FaceDanger)
#### `oracle:`

`oracle:` links can be used to refer to any Oracle by either its unique Datasworn identifier, or by its full name. It will open a popup window with the Oracle move table. When referencing by name, you'll need to remove any spaces.

Example: `[Background Assets](oracle:BackgroundAssets)` will render as [Background Assets](oracle:BackgroundAssets)
#### `asset:`

`asset:` links can be used to refer to any Asset by either its unique Datasworn identifier, or by its full name. It will open a popup window with a read-only Asset card. When referencing by name, you'll need to remove any spaces.

Example: `[Gunslinger](asset:Gunslinger)` will render as [Gunslinger](asset:Gunslinger)