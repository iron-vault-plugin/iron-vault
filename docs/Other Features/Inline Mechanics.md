Iron Vault can display move and oracle results as compact inline text instead of full mechanics code blocks. This creates a more natural reading experience when writing narrative prose.

### Enabling Inline Mechanics

Iron Vault provides granular control over which mechanics use inline format. Go to Iron Vault settings and you'll find five toggles under "Mechanics blocks":

- **Use inline moves & oracles** — Move and oracle results
- **Use inline progress tracks** — Create, advance, complete, and reopen track operations
- **Use inline clocks** — Create, advance, and resolve clock operations
- **Use inline meters** — Character meter changes, momentum burn, and initiative
- **Use inline entities** — Entity generation (NPCs, locations, etc.) when a file is created

Each can be enabled independently, so you can mix inline and block styles based on your preferences.

### Word Wrap Behavior

By default, inline mechanics can wrap across multiple lines when they reach the edge of your window. This means a long inline element (like a move with many adds) will flow naturally with your text rather than forcing the entire element to jump to a new line.

If you prefer inline mechanics to stay as atomic blocks that don't break across lines, you can disable **Inline mechanics word wrap** in settings. When disabled, the entire inline element moves to the next line if it doesn't fit, keeping all parts together.

### How It Works

When you perform an action with inline mechanics enabled, Iron Vault inserts a compact inline code snippet that renders as styled text within your paragraph.

**Example with mechanics block (default):**

```markdown
Argus attempts to climb down.

```iron-vault-mechanics
move "[Face Danger](move:starforged/adventure/face_danger)" {
  roll "shadow" action=4 stat=2 adds=0 vs1=1 vs2=6
}
```

It is difficult but he manages.
```

**Example with inline mechanics:**

```markdown
Argus attempts to climb down. `iv-move:Face Danger|shadow|4|2|0|1|6|move:starforged/adventure/face_danger` It is difficult but he manages.
```

The inline code renders as a styled span showing the move name, stat, outcome icon, and dice values—all in a single line that flows with your prose.

### What Gets Displayed

#### Moves

Inline moves display:
- **Move name** — Bold and clickable (opens in sidebar or modal)
- **Stat** — In parentheses, e.g., "(Iron)"
- **Outcome icon** — Strong hit, weak hit, or miss (uses the same icons as mechanics blocks)
- **Score and challenge dice** — e.g., "7 vs 1|5"
- **Match indicator** — "MATCH" when challenge dice match (strong hits and misses only)
- **Burn indicator** — 🔥 before the score when momentum was burned

Example renders:
- `Strike (Iron) ✓✓; 7 vs 1|5`
- `Face Danger (Shadow) ✓; 5 vs 3|7`
- `Battle (Heart) ✗✗; 4 vs 9|9 MATCH`
- `Enter the Fray (Heart) ✓✓; 🔥8 vs 6|9`

The left border color indicates the outcome: green for strong hit, orange for weak hit, red for miss.

Hovering over an inline move shows a tooltip with:
- The outcome text (e.g., "Strong hit")
- Full roll breakdown with labels (e.g., "4 (roll) + 2 (iron) + 1 (Asset) = 7")
- Burn info if applicable (e.g., "Burned momentum (8→2)")

#### Oracles

Inline oracles display:
- **Oracle name** — Bold and clickable (opens oracle modal), followed by a colon
- **Result** — The oracle result in italics
- **Cursed die** — 💀 with value if a cursed die was rolled (Sundered Isles)

Example renders:
- `Action: Bolster`
- `Shipwreck Details: Ruined supplies or provisions 💀7`

Hovering shows the roll value (e.g., "Roll: 45").

#### Progress Rolls

Progress rolls (like Fulfill Your Vow) display similarly to moves:
- **Track name** — Clickable link to the track file
- **Score and challenge dice**
- **Outcome icon**
- **Match indicator** if applicable

The track name links directly to the progress track file, making it easy to review the vow or other tracked objective.

#### No-Roll Moves

No-roll moves (like "Begin a Session" or "End a Session") display simply as:
- **Move name** — Bold and clickable (opens in sidebar or modal)

These moves don't involve dice, so they render as a minimal inline element showing just the move name.

#### Progress Tracks

Progress track operations display with Lucide icons:
- **⊞ Track name** — For newly created tracks (square-stack icon, clickable link to track file)
- **☑ Track name +N (boxes/10)** — For advancing tracks (copy-check icon), showing steps added and filled boxes
- **◉ Track name** — For completed tracks (circle-check-big icon)
- **↺ Track name** — For reopened tracks (rotate-ccw icon)

The boxes display shows progress as filled boxes out of 10 (e.g., `+2 (4/10)` means 4 boxes filled after adding 2 steps). This works consistently across all ranks since tracks always have 10 boxes.

The left border color indicates the operation: green for advance/complete, accent for create, orange for reopen.

Hovering shows details like the previous and current box count and rank.

#### Clocks

Clock operations display with Lucide icons:
- **🕐 Clock name** — For newly created clocks (clock icon, clickable link to clock file)
- **⏰ Clock name +N (current/total)** — For advancing clocks (clock-arrow-up icon), showing segments added and progress
- **✓ Clock name** — For resolved clocks (clock-check icon)

When a clock advance includes an odds roll, the result is shown with a shortened format:
- Successful: `Clock +2 (4/6) ✓Likely` showing the roll succeeded
- Failed: `Clock (2/6) ✗Likely` showing the roll didn't advance the clock (muted styling)

The full roll value is available in the tooltip on hover.

The left border color indicates the result: orange for successful advance, green for resolved, muted for failed odds roll.

#### Character Meters

Meter changes display:
- **Meter name N→M** — e.g., "Health 5→3"
- **🔥 Burn N→M** — For momentum burns, e.g., "🔥 Burn 8→2"
- **Initiative: old→new** — For initiative/position changes

The left border color indicates direction: green for increases, red for decreases, orange for burns.

#### Entity Generation

When you generate an entity (NPC, planet, faction, sector, etc.) with "Create entity file" checked, the inline displays:
- **📄 Entity Type: Entity Name** — File-plus icon with the entity type label and clickable name

Example renders:
- `📄 NPC: Kira Vex`
- `📄 Planet: Forge-7`
- `📄 Faction: The Iron Syndicate`

The entity name links to the created file, which contains all the oracle roll results in a table format. This keeps your journal clean while preserving the full generated details in the entity file.

Note: If you don't check "Create entity file" in the generation modal, the full mechanics block with all oracle rolls will be used instead, since there's no file to link to.

### Clickable Links

- **Move names** open in the sidebar by default, or in a modal if "Disable embedding moves in sidebar" is enabled in settings
- **Oracle names** always open the oracle reference modal
- **Track, clock, and entity names** open the corresponding file

This matches the behavior of links in mechanics code blocks.

### When to Use Inline Mechanics

Inline mechanics work best when you want your journal entries to read more like flowing narrative prose. They're especially useful for:

- Quick action sequences where multiple moves happen in succession
- Oracle rolls that inform your narrative without breaking the flow
- Shorter journal entries where full mechanics blocks feel heavy
- Progress track updates that are incidental to the story
- Meter changes during combat or exploration
- Entity generation when you want to reference the entity without showing all the oracle rolls

You can always switch back to mechanics blocks by disabling the setting—your existing inline mechanics will still render correctly.
