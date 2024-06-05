Iron Vault includes various settings for tweaking the behavior of its features, to allow you to shape it into a better tool for your use case.
### General

* **Use character system**: when enabled, this will look for an active [[Characters|Character]] file when making moves and doing other game operations. If disabled, Iron Vault will still work, but will prompt you for values of, for example, your stats. This is a good setting to disable if you only wish to use a particular subset of Iron Vault features, like [[Mechanics Blocks]] or the [[Sidebar]] but don't really care to use the various [[Commands/About|Commands]].

### New game object defaults

* **Default (x) folder**: Controls which folder to put various rollable [[Entities/About|Entities]] in by default. You can still pick the folder on an individual basis, or even move it, regardless of what these values are.
* **(x) template file**: If provided, the contents of these files will be added to the end of the new entity files when they're created. (Coming Soon) This will eventually be replaced with a more involved template system that will give you more control of how files are generated and formatted, and what additional frontmatter they include.

### Mechanics blocks

These options control various parts of how [[Mechanics Blocks]] are rendered.

* **Collapse move blocks**: when enabled (default), moves in mechanics blocks will only show the move name and result when first rendered, and you'll need to click on them in order to see move details.
* **Show mechanics toggle**: when enabled (default), mechanics blocks will have a small "Hide mechanics" toggle underneath them that, when clicked, will hide the mechanics block.
* **Hide mechanics completely**: If enabled, mechanics blocks will not be displayed at all. Good for when you just want to read a story. You can also toggle this setting by using the [[Toggle displaying mechanics]] command.

### Dice rolling

* **Prompt for rolls in Make a Move**: if enabled, when you [[Make a move]], the plugin will prompt you to roll your own dice and enter the values.
* **Prompt for rolls in Ask the Oracle**: if enabled, when you [[Ask the Oracle]], the plugin will prompt you to roll your own dice and enter the values.
