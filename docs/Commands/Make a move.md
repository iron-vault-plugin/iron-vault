---
tags:
  - Characters
---
Makes a Move based on the Moves available in the active [[Rulesets and Homebrew|Rulesets and Homebrew]]. If you've activated the [[Settings#General|Use character system Setting]], rollable moves will use values from your character sheet for your Stats. Otherwise, it will prompt you for the relevant Stat value. It will also prompt you for which Stat to roll as necessary.

When the Move has been made, the command will add a [[Mechanics Blocks#`move`|`move` mechanics node]] with the Move results into your current journal.

After it's made, you can also choose to invoke the [[Burn momentum]] command.

![[Mechanics Blocks#`move`#Example|iv-embed]]

### Skipping action move rolls

For some moves, like suffer moves, making a roll is sometimes optional. In those cases, you can still record that you made the move by selecting "Skip roll" when you are prompted for the stat. This will record an empty move block, where you can then record your meter changes and so on.

If you then wish to add an action roll, you can run [[Make an action roll]]. As long as the move with the skipped roll is still the last entry in the preceding mechanics block, the roll will be added to that move, after all other children.

You can use this process to create the Endure Harm node as above:

1. [[Make a move]] with "Endure Harm", picking "Skip roll" as the rollable stat when prompted.
2. Use other commands, such as [[Suffer on a meter]], to add other entries to the Endure Harm node.
3. Finally, if you decide you wish to make the Endure Harm roll, run [[Make an action roll]]. It will detect that the last move was Endure Harm and prompt you appropriately. The roll will be added to your Endure Harm block!