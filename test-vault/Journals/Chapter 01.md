I'm telling my story here.

Suddenly, a trap! Oh no!
```mechanics
move "Face Danger" {
	add 1 "because I'm cool"
	roll action=6 stat=3 adds=1 vs1=8 vs2=9
	- "ouch"
}
move "Endure Harm" {
    meter "health" -1
    roll action=3 stat=4 adds=0 vs1=3 vs2=8
}
move "Undertake an Expedition" {
    - "testing"
    roll action=3 stat=1 adds=0 vs1=3 vs2=5
    reroll action=1 vs1=6
    unknown "hahahah"
}
```
And then the rest of the fiction happened
```move
name: Compel
action: 3
stat: iron
statVal: 3
adds:
  - amount: 1
    desc: idk
challenge1: 4
challenge2: 4

```

```move
name: Endure Harm
action: 5
stat: health
statVal: 5
adds: []
challenge1: 1
challenge2: 5

```

