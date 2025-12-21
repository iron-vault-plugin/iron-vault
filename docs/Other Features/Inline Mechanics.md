Iron Vault can display move and oracle results as compact inline text instead of full mechanics code blocks. This creates a more natural reading experience when writing narrative prose.

### Enabling Inline Mechanics

To enable inline mechanics, go to Iron Vault settings and turn on **Use inline mechanics**. When enabled, move and oracle results will be inserted as inline text instead of mechanics code blocks.

### How It Works

When you make a move or roll an oracle with inline mechanics enabled, Iron Vault inserts a compact inline code snippet that renders as styled text within your paragraph.

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
- **Outcome icon** — Strong hit (✓✓), weak hit (✓), or miss (✗✗)
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
- Full roll breakdown with labels (e.g., "4 (roll) + 2 (iron) + 1(Asset) = 7")
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

Progress rolls display similarly to moves:
- **Track name**
- **Score and challenge dice**
- **Outcome icon**
- **Match indicator** if applicable

#### No-Roll Moves

No-roll moves (like "Begin a Session" or "End a Session") display simply as:
- **Move name** — Bold and clickable (opens in sidebar or modal)

These moves don't involve dice, so they render as a minimal inline element showing just the move name.

### Clickable Links

- **Move names** open in the sidebar by default, or in a modal if "Disable embedding moves in sidebar" is enabled in settings
- **Oracle names** always open the oracle reference modal

This matches the behavior of links in mechanics code blocks.

### When to Use Inline Mechanics

Inline mechanics work best when you want your journal entries to read more like flowing narrative prose. They're especially useful for:

- Quick action sequences where multiple moves happen in succession
- Oracle rolls that inform your narrative without breaking the flow
- Shorter journal entries where full mechanics blocks feel heavy

You can always switch back to mechanics blocks by disabling the setting—your existing inline mechanics will still render correctly.
