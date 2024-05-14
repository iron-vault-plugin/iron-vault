I'm telling my story here.

Suddenly, a trap! Oh no!

#character 
> #character 


```mechanics
move "Face Danger" {
	add 1 "because I'm cool"
	roll "shadow" action=1 stat=3 adds=1 vs1=9 vs2=9
	- "coooool"
}
- "Oh nooo [[Test]]. This is gonna hurt. Time to [[Endure Harm]]."
move "Endure Harm" {
    meter "health" -1
    roll "health" action=3 stat=4 adds=0 vs1=3 vs2=8
}
move "Undertake an Expedition" {
    - "testing"
    roll action=3 stat=1 adds=0 vs1=3 vs2=5
    reroll action=1 vs1=6
    reroll vs2=1 vs1=3
    unknown "hahahah"
}
move "Finish an Expedition" {
    progress-roll score=2 vs1=1 vs2=3
}
move "[[Chapter 02]]" {
  - "**bold text** *italic* [[README]]"
}
```
And then the rest of the fiction happened
```mechanics
move "Compel" {
    roll "iron" action=2 adds=0 stat=3 vs1=4 vs2=1
}
move "Endure Stress" {
    roll "spirit" action=1 adds=0 stat=5 vs1=1 vs2=10
}

move "Battle" {
    roll "iron" action=6 adds=0 stat=3 vs1=4 vs2=3
}

move "Endure Harm" {
    add 2 "this got added"
    add 2 "also this"
    roll "iron" action=4 adds=4 stat=3 vs1=10 vs2=8
}

```



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

