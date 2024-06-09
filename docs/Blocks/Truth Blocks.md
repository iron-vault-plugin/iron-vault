Truth blocks are used to render pickers for individual truths. When filled out and saved, they will insert the final truth text underneath themselves into the current file.

[[Truths]] are a core Ironsworn/Starforged concept, and one of the first things you'll do when you start a campaign. You can easily generate a Truths file with all your current rulesets' truths by using the [[Generate Truths]] command.

Truth blocks expect the name of the Truth they'll be dealing with as the first line in their bodies. A second optional line with the text `inserted` will set the Truth block to its "click to reset" state, and is usually automatically written when you click save on the block.

Resetting the Truth block will reset it to its initial state and insert an `Old Truth:` header underneath, to separate your previously-generated truth text from the new one, so it won't delete any text you had there before that you might want to keep or reference.

Truth blocks let you either pick your truth options from a dropdown, or click on a die icon to randomize them according to the rules' oracle table.

Once the Truth is generated, you are free to edit the Truth text any way you see fit: it's just regular text in the file!

You can also choose to split your truths between multiple files, by just putting the `iron-vault-truth` blocks into separate files.
#### Example

The following file:

````markdown
## Cataclysm
```iron-vault-truth
Cataclysm
```
````

Will generate something that looks like this:

<hr>

`Truths.md`
##### Cataclysm
```iron-vault-truth
Cataclysm
```

<hr>

If you select all required items, you'll be able to click on the save icon, at which point you'll end up with this:

<hr>

`Truths.md`
##### Cataclysm
```iron-vault-truth
Cataclysm
inserted
```
The anomaly traveled at incredible speeds, many times faster than light itself, and snuffed out the stars around us before we realized it was coming. Few of us survived as we made our way to this new galaxy. Here in the Forge, the stars are still aflame. We cling to their warmth like weary travelers huddled around a fire.

We suspect the sun plague was caused by:

Superweapon run amok

<hr>

You can click on `Reset Truth Picker` at any point after this to reset the picker, and allow you to pick truths again. An `Old Truth:` header will be inserted below the picker to separate your old truth, which will not be automatically deleted:

<hr>

`Truths.md`
##### Cataclysm
```iron-vault-truth
Cataclysm
```
##### Old Truth:

The anomaly traveled at incredible speeds, many times faster than light itself, and snuffed out the stars around us before we realized it was coming. Few of us survived as we made our way to this new galaxy. Here in the Forge, the stars are still aflame. We cling to their warmth like weary travelers huddled around a fire.

We suspect the sun plague was caused by:

Superweapon run amok

<hr>

At this point, you can repeat the process of selecting your truths, and then delete or edit your Old Truth as needed.