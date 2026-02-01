Iron Vault can display game mechanics as compact inline elements that flow naturally with your prose. Instead of full [[Mechanics Blocks|mechanics code blocks]], inline mechanics render as styled spans within your paragraphs, creating a more narrative reading experience.

## Enabling Inline Mechanics

In Iron Vault settings under "Inline mechanics", enable **Use inline mechanics** to switch from code blocks to inline format. This single toggle affects all mechanics types: moves, oracles, progress tracks, clocks, meters, entities, dice rolls, and OOC comments.

## How It Works

When you perform an action with inline mechanics enabled, Iron Vault inserts a compact code snippet that renders as styled text within your paragraph.

**With mechanics blocks (default):**

> [!INFO] **With Mechanics Blocks (default):**
> Kira attempts to slip past the guards.
> 
> ```iron-vault-mechanics
> move "[Face Danger](move:starforged/adventure/face_danger)" {
>   roll "shadow" action=4 stat=2 adds=0 vs1=1 vs2=6
> }
> ```
> 
> She manages to stay hidden.


> [!INFO] **With Inline Mechanics Enabled**
> Kira attempts to slip past the guards. `iv-move:Face Danger|shadow|4|2|0|1|6|move:starforged/adventure/face_danger` She manages to stay hidden.

The inline code renders as a styled span showing the move name, stat, outcome icon, score, and challenge dice. 

## Hiding Mechanics

The **Hide mechanics completely** setting (found in Iron Vault plugin settings) hides all mechanics from view (both inline mechanics and code blocks). This is useful when you want to read your journal as pure narrative without any game mechanics visible. The mechanics are still in your notes, they're just hidden from display. You can also toggle this quickly using the "Toggle displaying mechanics" command.

## Clickable Links

Inline mechanics include clickable elements:

- **Move names** - Open in the sidebar by default, or in a modal if "Disable embedding moves in sidebar" is enabled
- **Oracle names** - Open the oracle reference modal
- **Track, clock, and entity names** - Open the corresponding file

This matches the behavior of links in mechanics code blocks.

## Inline Mechanics Types

Iron Vault supports 19 different inline mechanic types, organized into categories below.

### Moves

#### Moves (`iv-move`)

Displays action roll results with outcome styling.

**Syntax:**
```
`iv-move:<name>|<stat>|<action>|<statVal>|<adds>|<vs1>|<vs2>[|<moveId>][|burn=<orig>:<reset>][|adds=<detail>]`
```

**Parameters:**
- `name` - Move name (e.g., "Face Danger")
- `stat` - Stat used (e.g., "shadow")
- `action` - Action die result (typically 1-6 for a standard d6, but may vary with custom dice settings)
- `statVal` - Stat value
- `adds` - Total adds (sum of all bonuses)
- `vs1`, `vs2` - Challenge dice results (typically 1-10 for d10s, but may vary with custom dice settings)
- `moveId` (optional) - Datasworn move ID for linking
- `burn` (optional) - Momentum burn as `orig:reset` (momentum value used, then reset value)
- `adds` (optional) - Detailed adds breakdown as `amount(desc),amount(desc)` for tooltip display

**Examples:**
`iv-move:Strike|iron|4|2|1|3|7`
`iv-move:Face Danger|shadow|3|2|0|5|9|move:starforged/adventure/face_danger`
`iv-move:Clash|iron|4|2|3|3|7|move:starforged/combat/clash|burn=8:2|adds=2(Asset),1(Companion)`

**Display:** Shows outcome icon, move name (clickable if moveID is provided), stat in parentheses, score, and challenge dice. Left border indicates outcome (green/orange/red). Burn shows a flame icon. Match shows "MATCH" text.

**Tooltip:** Shows outcome text, full roll breakdown including adds, and burn info if applicable.

---

#### Progress Rolls (`iv-progress`)

Displays progress roll results (Fulfill Your Vow, etc.).

**Syntax:**
```
`iv-progress:<moveName>|<trackName>|<score>|<vs1>|<vs2>[|<trackPath>][|<moveId>]`
```

**Parameters:**
- `moveName` - The progress move name (e.g., "Fulfill Your Vow")
- `trackName` - Name of the progress track
- `score` - Progress score (filled boxes, 0-10)
- `vs1`, `vs2` - Challenge dice results
- `trackPath` (optional) - Path to track file for linking
- `moveId` (optional) - Datasworn move ID for linking

**Examples:**
`iv-progress:Fulfill Your Vow|My Vow|7|3|9`
`iv-progress:Fulfill Your Vow|My Vow|7|3|9|Campaign/Progress/My Vow.md`
`iv-progress:Fulfill Your Vow|My Vow|7|3|9|Campaign/Progress/My Vow.md|move:starforged/quest/fulfill_your_vow`

**Display:** Shows outcome icon, move name (clickable), track name (clickable if path provided), score, and challenge dice.

---

#### No-Roll Moves (`iv-noroll`)

Displays moves that don't require dice rolls (Begin a Session, etc.).

**Syntax:**
```
`iv-noroll:<name>[|<moveId>]`
```

**Parameters:**
- `name` - Move name
- `moveId` (optional) - Datasworn move ID for linking

**Examples:**
`iv-noroll:Begin a Session`
`iv-noroll:Begin a Session|move:starforged/session/begin_a_session`

**Display:** Shows a file-pen icon and the move name (clickable if moveId provided).

---

### Oracles

#### Oracle Rolls (`iv-oracle`)

Displays oracle roll results.

**Syntax:**
```
`iv-oracle:<name>|<roll>|<result>[|<oracleId>][|cursed=<value>]`
```

**Parameters:**
- `name` - Oracle name
- `roll` - Die roll result (1-100)
- `result` - Oracle result text
- `oracleId` (optional) - Datasworn oracle ID for linking
- `cursed` (optional) - Cursed die value (Sundered Isles)

**Examples:**
`iv-oracle:Action|45|Bolster`
`iv-oracle:Action|45|Bolster|oracle:starforged/core/action`
`iv-oracle:Cursed Cargo|67|Haunted remains|oracle:sundered_isles/oracles/shipwrecks/cursed_cargo|cursed=7`

**Display:** Shows sparkles icon, oracle name with colon (clickable), and result. Cursed die shows skull icon with value.

**Tooltip:** Shows roll value and cursed die value if present.

---

### Progress Tracks

#### Track Create (`iv-track-create`)

Records creation of a new progress track.

**Syntax:**
```
`iv-track-create:<name>|<path>`
```

**Examples:**
`iv-track-create:Swear to protect the village|Campaign/Progress/Protect Village.md`

**Display:** Shows square-stack icon and track name (clickable link to file).

---

#### Track Advance (`iv-track-advance`)

Records progress marked on a track.

**Syntax:**
```
`iv-track-advance:<name>|<path>|<from>|<to>|<rank>|<steps>`
```

**Parameters:**
- `name` - Track name
- `path` - Path to track file
- `from` - Starting ticks (0-40)
- `to` - Ending ticks (0-40)
- `rank` - Challenge rank (troublesome, dangerous, formidable, extreme, epic)
- `steps` - Number of times progress was marked

**Examples:**
`iv-track-advance:My Vow|Progress/My Vow.md|4|8|dangerous|2`
`iv-track-advance:Epic Quest|Progress/Epic.md|0|4|epic|1`

**Display:** Shows copy-check icon, track name (clickable), steps added, and boxes filled (e.g., "+2 (4/10)").

**Tooltip:** Shows previous and current box count and rank.

---

#### Track Complete (`iv-track-complete`)

Records completion of a progress track.

**Syntax:**
```
`iv-track-complete:<name>|<path>`
```

**Examples:**
`iv-track-complete:My Vow|Progress/My Vow.md`

**Display:** Shows square-check-big icon and track name (clickable).

---

#### Track Reopen (`iv-track-reopen`)

Records reopening a previously completed track.

**Syntax:**
```
`iv-track-reopen:<name>|<path>`
```

**Examples:**
`iv-track-reopen:My Vow|Progress/My Vow.md`

**Display:** Shows rotate-ccw icon and track name (clickable).

---

### Clocks

#### Clock Create (`iv-clock-create`)

Records creation of a new clock.

**Syntax:**
```
`iv-clock-create:<name>|<path>`
```

**Examples:**
`iv-clock-create:The Storm Arrives|Clocks/Storm.md`

**Display:** Shows clock icon and clock name (clickable link to file).

---

#### Clock Advance (`iv-clock-advance`)

Records advancement of a clock, optionally with an odds roll.

**Syntax:**
```
`iv-clock-advance:<name>|<path>|<from>|<to>|<segments>|<total>[|odds=<odds>:<roll>:<result>]`
```

**Parameters:**
- `name` - Clock name
- `path` - Path to clock file
- `from` - Starting filled segments
- `to` - Ending filled segments
- `segments` - Number of segments added
- `total` - Total clock segments (4, 6, 8, or 10)
- `odds` (optional) - Odds roll as `odds:roll:result` (e.g., "Likely:45:Yes")

**Examples:**
`iv-clock-advance:Danger|Clocks/Danger.md|2|4|2|6`
`iv-clock-advance:Conspiracy|Clocks/Conspiracy.md|2|4|2|6|odds=Likely:45:Yes`
`iv-clock-advance:Conspiracy|Clocks/Conspiracy.md|2|2|2|6|odds=Unlikely:85:No`

**Display:** Shows clock-arrow-up icon, clock name (clickable), segments added, and progress (e.g., "+2 (4/6)"). Successful odds rolls show "✓Likely", failed show "✗Unlikely" with muted styling.

**Tooltip:** Shows segment change and odds roll details.

---

#### Clock Resolve (`iv-clock-resolve`)

Records resolution of a clock.

**Syntax:**
```
`iv-clock-resolve:<name>|<path>`
```

**Examples:**
`iv-clock-resolve:The Storm Arrives|Clocks/Storm.md`

**Display:** Shows circle-check-big icon and clock name (clickable).

---

### Character State

#### Meter Changes (`iv-meter`)

Records changes to character meters (health, spirit, supply, etc.).

**Syntax:**
```
`iv-meter:<name>|<from>|<to>`
```

**Examples:**
`iv-meter:Health|5|3`
`iv-meter:Spirit|2|4`
`iv-meter:Momentum|4|3`

**Display:** Shows trending-up or trending-down icon based on direction, meter name, and change (e.g., "Health 5→3"). Left border is green for increases, red for decreases.

---

#### Momentum Burn (`iv-burn`)

Records burning momentum to improve a roll.

**Syntax:**
```
`iv-burn:<from>|<to>`
```

**Examples:**
`iv-burn:8|2`
`iv-burn:10|2`

**Display:** Shows flame icon, "Burn" label, and change. Orange left border.

---

#### Initiative/Position (`iv-initiative`)

Records changes in initiative or position state.

**Syntax:**
```
`iv-initiative:<label>|<from>|<to>`
```

**Parameters:**
- `label` - Label text (e.g., "Initiative", "Position")
- `from` - Previous state (can be empty)
- `to` - New state

**Valid states:** "in control", "in a bad spot", "out of combat"

**Examples:**
`iv-initiative:Position|in control|in control` 
`iv-initiative:Position|in control|in a bad spot` 
`iv-initiative:Position|in a bad spot|out of combat` 

**Display:** Shows footprints icon, label with colon, and current state. Border color reflects state (green for "in control", red for "in a bad spot").

---

### Entities

#### Entity Create (`iv-entity-create`)

Records creation of an entity file (NPC, planet, faction, etc.).

**Syntax:**
```
`iv-entity-create:<entityType>|<name>|<path>`
```

**Examples:**
`iv-entity-create:NPC|Kira Vex|Entities/NPCs/Kira Vex.md`
`iv-entity-create:Planet|Forge-7|Entities/Planets/Forge-7.md`
`iv-entity-create:Faction|The Iron Syndicate|Entities/Factions/Iron Syndicate.md`

**Display:** Shows file-plus icon, entity type label, and entity name (clickable link to file).

---

### Dice

#### Dice Roll (`iv-dice`)

Records an arbitrary dice roll.

**Syntax:**
```
`iv-dice:<expression>|<result>`
```

**Examples:**
`iv-dice:2d6+1|8`
`iv-dice:1d100|67`
`iv-dice:3d6|12`

**Display:** Shows dice icon, expression, arrow, and result.

---

#### Action Roll (`iv-action-roll`)

Records an action roll without an associated move.

**Syntax:**
```
`iv-action-roll:<stat>|<action>|<statVal>|<adds>|<vs1>|<vs2>[|burn=<orig>:<reset>][|adds=<detail>]`
```

**Examples:**
`iv-action-roll:iron|4|2|1|3|7`
`iv-action-roll:shadow|3|2|0|5|9|burn=8:2`
`iv-action-roll:heart|5|3|2|4|6|adds=1(Bond),1(Asset)`

**Display:** Similar to moves but without a move name. Shows outcome icon, stat in parentheses, score, and challenge dice.

---

#### Reroll (`iv-reroll`)

Records rerolling a die from a previous roll.

**Syntax:**
```
`iv-reroll:<die>|<oldVal>|<newVal>|<stat>|<statVal>|<adds>|<vs1>|<vs2>|<action>`
```

**Parameters:**
- `die` - Which die was rerolled: "action", "vs1", or "vs2"
- `oldVal` - Original die value
- `newVal` - New die value after reroll
- `stat` - Stat name
- `statVal` - Stat value
- `adds` - Total adds
- `vs1`, `vs2` - Challenge dice (updated if one was rerolled)
- `action` - Action die value (updated if it was rerolled)

**Examples:**
`iv-reroll:action|3|6|iron|2|1|4|7|6`
`iv-reroll:vs1|8|3|shadow|2|0|3|5|4`

**Display:** Shows refresh icon, outcome icon, which die changed (e.g., "(act: 3→6)"), new score, and challenge dice. The rerolled die is highlighted.

---

### Comments

#### Out-of-Character (`iv-ooc`)

Records out-of-character comments or notes.

**Syntax:**
```
`iv-ooc:<text>`
```

**Examples:**
`iv-ooc:Need to look up the rules for this`
`iv-ooc:Taking a break here`
`iv-ooc:Remember to add the bond with Ash later`

**Display:** Shows message-square icon and italic comment text.


