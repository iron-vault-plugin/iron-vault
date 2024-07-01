*Make an action roll* can be used to create a freestanding action roll, not attached to a move. You'll follow similar prompts to when you [[Make a move]] with an action roll-- only you won't select a move, and the roll will be inserted by itself:

```iron-vault-mechanics
roll "edge" action=6 adds=0 stat=2 vs1=9 vs2=5
```

If you *Make an action roll* right after an empty move, *Make an action roll* will add the roll to that move, rather than making it a freestanding top-level entry. As described in [[Make a move#Skipping action move rolls]], this is useful for using suffer moves like "Endure Harm", if you wish to record the meter change under the move heading and then decide whether you want to make the roll to prevent the harm.