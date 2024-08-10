You can create a custom playset using a relatively simple syntax that will be familiar to anyone who has worked with `.gitignore` files before.

To get started, while you are [[Creating a campaign|creating]] or [[Editing a campaign|editing]] a campaign, click the **Configure** button next to the **Custom** playset option. This will launch the **Playset editor** modal:

![[Playset editor.png|400]]

From here, you can browse the built-in playsets for inspiration and then when you are ready choose "Custom playset" from the "Playset" dropdown.

As you type, validation messages will display below the edit box so you know if you have any syntax issues. The search list at the bottom will also update to show you which content would be included and which excluded by your configuration.

## Playset configuration

A playset is a set of lines that tell Iron Vault which content it should include or exclude.

Here's an example config that you might use if you were running a hard sci-fi Starforged game:

```
@include(starforged)
asset:sundered_isles/** [starforged.recommended=true]
!asset:** [core.supernatural=true]
```

This does three things:

- Includes the built-in "starforged" playset
- Adds to it all assets from Sundered Isles that are *tagged* as "recommended" for Starforged
- Filters out any of the Starforged or Sundered Isles assets that are tagged as "supernatural"

Before we can describe the playset syntax in detail, we need to cover a few prerequisites first.

### Datasworn

#### Datasworn IDs

As discussed in [[Rulesets and Homebrew]], Iron Vault is built on top of the [[Datasworn]] library. You can think of a Datasworn rules package as a tree-structured representation of all of the content in Ironsworn/Starforged/etc. Each piece of independent content (e.g., a move, an asset, an oracle) has an ID of the form:

`<type>:<package id>/<path>`

The Datasworn types currently supported by Iron Vault playsets are:

* `oracle_rollable`
* `move`
* `asset`
* `truth`

Iron Vault playsets can also filter on an additional "virtual type":

* `rules_package`
	* This virtual type corresponds to the base of a Datasworn ruleset or expansion file. In particular, you must include this to get Datasworn `rules` elements, such as stats, condition meters, and impacts.
	* We also use the rules_package IDs to activate special handling specific to different base rulesets but not represented in Datasworn currently, such as the terminology for combat initiative/position.
	* IDs of this type include only the package ID and no path, e.g., `rules_package:starforged` matches the `starforged` rules package

#### Embedded content

The main Datasworn types listed above are used to describe roughly standalone content, such as a core game move or a complete asset. In addition, sometimes content is intended for use only in the context of another piece of content. For example, some assets (for example, Starforged's Empath asset) grant you additional moves (e.g., Empath's "Read heart" move); in the Empath example, we say the "Read Heart" move is embedded in the "Empath" asset.

IDs for embedded content combine multiple corresponding segments of types and paths. Continuing with the example above, "Read Heart" has ID `asset.ability.move:starforged/path/empath.0.read_heart`. Reading this from right to left, this tells us we are looking for a move called "read_heart" that is in ability "0" (the first ability) of the asset at `starforged/path/empath`.
#### Tags

In addition to IDs, some Datasworn content is marked with tags of the form `<package id>.<tag id>`. This is currently used to mark Starforged assets recommended for Sundered Isles (and vice versa) as well as the Sundered Isles "technological" and "supernatural" designations.
### Datasworn ID globs

Iron Vault introduces a way to match patterns on Datasworn IDs using wildcard expressions (similar to [shell path globs](https://en.wikipedia.org/wiki/Glob_(programming))).

Like a Datasworn ID, each pattern must have the form:

`<type pattern>:<path pattern>`

Type pattern can be either `*` or any of the [[#Datasworn IDs|Datasworn types described above]]. A `*` matches any Datasworn type whatsoever.

A path pattern is made up of one or more path segments separated by a `/` character. A path segment can be a mix of legal literal characters (`a-z`, `0-9`, `_`, and `-`) and wildcards (`*`), which match zero or more legal characters. For example, `e*e*` would match `empowered` and `explorer` but not `empath`. A wildcard in a path segment never matches a `/`.

A path segment can also be a `**`, which functions like `*` but matches 0 or more complete path segments. For example `asset:starforged/**` matches `asset:starforged`, `asset:starforged/path`, and `asset:starforged/path/empath`.

A datasworn ID glob ALWAYS matches all [[#Embedded content]] under a matching pattern. Thus, the pattern `asset:starforged/path/empath` also matches `asset.ability.move:starforged/path/empath.0.read_heart`.
### Playset syntax

With those fundamentals, we can now describe the syntax of the playset configuration.

Each line of a playset configuration must be one of the following:

* A [[#Glob statement]]
* An [[#@include statement]]

You may also include blank lines or comment lines starting with `#`; these will be ignored.

When determining whether a playset includes a particular piece of content, Iron Vault goes through each of the lines from last to first, until it finds a line that matches the content and issues a *determination* (either an explicit *include* or *exclude*). If no line generates a *determination*, the playset will exclude the content implicitly.
#### Glob statement

A glob statement is a [[#Datasworn ID globs]] as described above. If the glob matches the current content, then an *explicit include determination* will be made.

If the line is prefixed with a `!`, an *explicit exclude determination* will be made instead.

A glob statement can also be refined by tags. These tags must match, in addition to the ID glob matching, in order for this line to match and generate a determination. To match a single tag, add `[packageId.tagId=value]` after the glob. Multiple tags can be matched by separating them with an ampersand, e.g., `[pkg1.tag1=value&pkg1.tag2=value&pkg2.tag3=value]`.

Tag values can either be:

* A boolean value `true` or `false`
* A number, e.g., `1`
* A string enclosed in double quotes, e.g., `"this string"`

Examples:

```
# Include everything in the starforged rules package
*:starforged/**

# Include all Sundered Isles assets (and their embedded content)
#  as long as they have the starforged.recommended=true tag
asset:sundered_isles/** [starforged.recommended=true]

# Exclude all assets that are tagged as technological
!asset:** [core.technological=true]
```

Because the last pattern wins, this playset config would include everything in starforged and all Sundered Isles assets that are tagged as recommended *EXCEPT* that it would exclude *ANY* asset that is tagged as technological (in both Starforged and Sundered Isles)

#### @include statement

A line of the form `@include(playsetid)` incorporates all of the lines of the built-in Playset with id `playsetid` in place of the `@include` line. You can use the Playset dropdown in the Playset editor described above to find ids of existing playsets.