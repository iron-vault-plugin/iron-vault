---
tags:
  - Clocks
---
Creates a [[Entities/Clocks|Clock]] file and appends a [[Mechanics Blocks#`clock`|`clock` mechanics node]] to the current journal. The Clock file will have all necessary frontmatter for commands like [[Advance a clock]] to work.

When creating a clock, you'll need to set two clock-specific options:

* Number of segments in the clock
* The "default odds" for the clock:
	* If this is "no roll" (the default), then your clock will always be advanced automatically when you [[Advance a clock]].
	* If you pick a different odds value, when you [[Advance a clock]], you will be presented with the option to make a roll whenever you advance, and the chosen value will be preselected.

This command will also write a [[Clock Blocks|Clock Block]] to the newly-made Clock file:

![[Mechanics Blocks#`clock`#Example|iv-embed]]
![[Doomsday Device|iv-embed]]