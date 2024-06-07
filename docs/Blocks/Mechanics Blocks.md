### About

This plugin renders a [KDL](https://kdl.dev/) block into a formatted
Ironsworn/Starforged mechanics block, with nice styling and all that.

It takes an Obsidian note that looks like this:

![[mechanics-raw.png|500]]

and turns it into this:

![[mechanics-rendered.png|500]]

Most mechanics nodes accept arguments either as properties, or BOA (by order of arguments).

That is, a node with arguments `a`, `b`, and `c` can be written as:

```kdl
node 1 2 3
```

or as:

```kdl
node a=1 b=2 c=3
```

Exceptions are noted in node documentation with ("not BOA").

Some arguments also support markdown rendering, and are marked as `md`.

### Settings

There are [[Settings#Mechanics blocks|various settings]] for tweaking how and whether mechanics blocks are rendered. See the Settings documentation for more information.
### Nodes

#### `move`

Declares a new move. Can contain any other nodes except for `move`. Shows
icons for hit kind and whether there was a match, and can be expanded or
collapsed to show or hide the contained nodes.

##### Arguments

- `id` (optional): datasworn ID of the move
- `name` (optional, md): the name of the move

##### Children

Any node, except for `move`.

##### Example

```mechanics
move "Face Danger" {
    roll action=6 stat=3 adds=0 vs1=8 vs2=9
    - "ouch"
}
move "Endure Harm" {
    meter "health" from=3 to=2
    roll action=3 stat=4 adds=0 vs1=3 vs2=5
}
```
````kdl
```mechanics
move "Face Danger" {
    roll action=6 stat=3 adds=0 vs1=8 vs2=9
    - "ouch"
}
move "Endure Harm" {
    meter "health" from=3 to=2
    roll action=3 stat=4 adds=0 vs1=3 vs2=5
}
```
````

#### `-` (dash)

Adds an "arbitrary" text entry under the move. You can put anything in here.

(BOA only)

##### Arguments

- `text` (md): the text to display
##### Example
```mechanics
- "Oh man that was interesting"
```
````kdl
```mechanics
- "Oh man that was interesting"
```
````

#### `add`

Records an "add" for an upcoming challenge roll, along with its reason.
##### Arguments

* `amount`: the number of points to add to the roll
* `from` (optional, md): the reason for the add (e.g. `from="Bond with [[Ash]]`)

##### Example
```mechanics
add 2 "Bond with [[Ash]]"
```
````kdl
```mechanics
add 2 "Bond with [[Ash]]"
```
````
#### `roll`

Adds a regular roll to the move. If used inside a `move` block, will set its
result.
##### Arguments

- `stat-name` (optional): the name of the stat to roll against
- `action`: the value of the action die
- `stat`: the value of the stat to add
- `adds` (optional, default: 0): the total value of the adds
- `vs1`: the first challenge die
- `vs2`: the second challenge die
##### Example
```mechanics
// This will be rendered as a Weak Hit
roll "heart" action=3 stat=2 adds=1 score=6 vs1=3 vs2=7
```
````kdl
```mechanics
// This will be rendered as a Weak Hit
roll "heart" action=3 stat=2 adds=1 score=6 vs1=3 vs2=7
```
````

#### `progress-roll`

Renders a progress roll. If used inside a `move` block, will set its result.
##### Arguments

- `score`: the number of filled track boxes the progress move is rolling against
- `vs1`: the first challenge die
- `vs2`: the second challenge die
##### Example
```mechanics
// This will render as a Miss on progress
progress-roll score=5 vs1=6 vs2=7
```
````kdl
```mechanics
// This will render as a Miss on progress
progress-roll score=5 vs1=6 vs2=7
```
````

#### `reroll`

Rerolls one or more dice from a previous roll. If used inside a move, the
move's result will be automatically updated. It's an error to use this if there's no previous roll in the current Mechanics Block.

(not BOA)
##### Arguments

- `action` (optional): the new value of the action die
- `vs1` (optional): the new value of the first challenge die
- `vs2` (optional): the new value of the second challenge die
##### Example
```mechanics
move "Face Danger" {
    // weak hit (score = 6)
    roll action=3 stat=2 adds=1 vs1=3 vs2=7

    // strong hit (score = 9)
    reroll action=6 vs1=5
}
```
````kdl
```mechanics
move "Face Danger" {
    // weak hit (score = 6)
    roll action=3 stat=2 adds=1 vs1=3 vs2=7

    // strong hit (score = 9)
    reroll action=6 vs1=5
}
```
````

#### `meter`

Shows meter changes.

##### Arguments

- `name`: the name of the meter (e.g. "health")
- `from`: the starting value of the meter
- `to`: the ending value of the meter

##### Example
```mechanics
meter "health" from=3 to=2
```
````kdl
```mechanics
meter "health" from=3 to=2
```
````

#### `burn`

Burn momentum. Note that for "normal" momentum changes, you should use [`meter`](#meter) instead.

##### Arguments

- `from`: the starting momentum amount.
- `to`: the ending momentum amount.

##### Example
```mechanics
burn from=3 to=2
```
````kdl
```mechanics
burn from=3 to=2
```
````

#### `progress`

Marks progress on a progress track. Can be used interchangeably with `track`,
but has a nicer interface when what you want to express is "mark progress
twice" without having to figure out tick details yourself.

Box/tick amounts can be given either as a single `from` argument, or with
`from-boxes`/`from-ticks`.

(not BOA)
##### Arguments

- `name` (md): the name of the progress track.
- `from` (optional): the starting value of the progress track, in total ticks.
- `from-boxes` (optional): the starting value of the progress track, in boxes.
- `from-ticks` (optional): the starting value of the progress track, in ticks
  filled into the last unfilled box.
- `rank` - the challenge rank of the progress track (e.g. `"formidable"`, `"epic"`, etc).
- `steps` (optional, default: 1) - number of times to mark progress.
##### Example
```mechanics
progress "My Background Vow" from-boxes=3 from-ticks=2 rank="formidable" steps=2
```
````kdl
```mechanics
progress "My Background Vow" from-boxes=3 from-ticks=2 rank="formidable" steps=2
```
````

#### `track`

Marks progress on a progress track. Can be used interchangeably with
`progress`, but doesn't encode the track challenge rank or the number of
times progress was marked. Most often, this node would be used for moves that
say something like "erase two ticks from TKTK".

(not BOA)
##### Arguments

- `name` (md): the name of the progress track.
- `status` (optional): a status change for the track. Can be either "added" or "removed". If this argument is present, all other arguments except `name` are ignored.
- `from` (optional): the starting value of the progress track, in total ticks.
- `from-boxes` (optional): the starting value of the progress track, in boxes.
- `from-ticks` (optional): the starting value of the progress track, in ticks
  filled into the last unfilled box.
- `to` (optional): the ending value of the progress track, in total ticks.
- `to-boxes` (optional): the ending value of the progress track, in boxes.
- `to-ticks` (optional): the ending value of the progress track, in ticks
  filled into the last unfilled box.
##### Example
```mechanics
track "My Background Vow" status="added"
track "My Background Vow" from-boxes=3 from-ticks=2 to-boxes=4 to-ticks=1
```
````kdl
```mechanics
track "My Background Vow" status="added"
track "My Background Vow" from-boxes=3 from-ticks=2 to-boxes=4 to-ticks=1
```
````

#### `xp`

Renders a change (positive or negative) in experience points.
##### Arguments

- `from`: the starting number of experience points.
- `to`: the ending number of experience points.
##### Example
```mechanics
xp from=3 to=5
```
````kdl
```mechanics
xp from=3 to=5
```
````

#### `clock`

Renders a change in a clock.
##### Arguments

- `name` (md): the name of the clock.
- `status` (optional): a status change for the clock. Can be either "added" or "removed". If this argument is present, all other arguments except `name` are ignored.
- `from`: the starting number of segments filled.
- `to`: the ending number of segments filled.
- `out-of`: the total number of segments in the clock.
##### Example
```mechanics
clock "The Doomsday Device Explodes" status="added"
clock "The Doomsday Device Explodes" from=3 to=5 out-of=6
```
````kdl
```mechanics
clock "The Doomsday Device Explodes" status="added"
clock "The Doomsday Device Explodes" from=3 to=5 out-of=6
```
````

#### `oracle`

Records an oracle roll and its result.
##### Arguments

* `name` (md): the name of the oracle
* `roll`: the value of the percentile die roll
* `result` (md): The resulting value of the oracle roll.
##### Children

`oracle` nodes may be nested, meaning you can have `oracle`s inside `oracles`.
##### Example
```mechanics
oracle "[Character Name > Given Name](oracle:GivenName)" roll=34 result="Esana" {
  oracle "Something else" 2 "foo"
}
```
````kdl
```mechanics
oracle "[Character Name > Given Name](oracle:GivenName)" roll=34 result="Esana" {
  oracle "Something else" 2 "foo"
}
```
````

#### `oracle-group`

Utility node for grouping related [[#`oracle`|`oracle`]]s together.
##### Arguments

* `name` (md): a label for this group
##### Children

Any `oracle` or `oracle-group` nodes.
##### Example
```mechanics
oracle-group "Character Name" {
  oracle "Given Name" roll=30 result="Eren"
  oracle "Callsign" roll=72 result="Rook"
  oracle "Family Name" roll=42 result="Bridger"
}
```
````kdl
```mechanics
oracle-group "Character Name" {
  oracle "Given Name" roll=30 result="Eren"
  oracle "Callsign" roll=72 result="Rook"
  oracle "Family Name" roll=42 result="Bridger"
}
```
````

#### `asset`

Records additions, removals, and upgrades of character assets.
##### Arguments
* `name` (md): the name of the asset
* `status`: the operation being performed on the asset. One of `added`, `removed`, `upgraded`.
* `ability` (optional): the (1-based) index of the ability being upgraded. This should only be used when `status` is `upgraded`.
##### Example
```mechanics
asset "[Empath](asset:Empath)" status="upgraded" ability=1
```
````kdl
```mechanics
asset "[Empath](asset:Empath)" status="upgraded" ability=1
```
````

#### `impact`

Records marking and unmarking of impacts.
##### Arguments

* `name` (md): the name of the impact
* `marked`: the new status of the impact. `true` or `false`.
##### Example
```mechanics
impact "Permanently Harmed" true
```
````kdl
```mechanics
impact "Permanently Harmed" true
```
````