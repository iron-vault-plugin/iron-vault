I'm telling my story here.

Suddenly, a trap! Oh no!

#character 
> #character 


```mechanics
move id="starforged/moves/adventure/face_danger" {
	add 1 "because I'm cool [[Ash Barlowe]]"
	roll "shadow" 1 3 1 9 9 // <statname> <action-die> <stat> <adds> <vs1> <vs2>
}
- "Oh nooo. This is gonna hurt. Time to [[Endure Harm]]. bla bla bla bla bla bla bla bla bla bla"
move "Endure Harm" {
    meter "health" from=3 to=2
	meter "health" 3 2 // <meter> <from> <to>
    roll "health" action=3 stat=4 adds=0 vs1=3 vs2=8
    meter "momentum" from=7 to=6
    meter "health" from=2 to=3
}
move "Undertake an Expedition" {
    - "testing"
    roll action=3 stat=1 adds=0 vs1=3 vs2=5
    reroll action=1 vs1=6
    reroll vs2=7 vs1=8
    burn from=10 to=2
    burn 10 2 // <from> <to>
    unknown "hahahah"
}
move "Finish an Expedition" {
    progress-roll score=2 vs1=1 vs2=3
    progress-roll 2 1 3 // <score> <vs1> <vs2>
}
move "[[Chapter 02]]" {
  - "**bold text** *italic* [[README]]"
}
```
And then the rest of the fiction happened

```mechanics
move "Clash" {
    roll "iron" action=1 adds=0 stat=3 vs1=8 vs2=7
}
```


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

