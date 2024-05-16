I'm telling my story here.

Suddenly, a trap! Oh no!

#character 
> #character 

Lorem ipsum dolor sit amet, consectetur adipiscing elit. In sodales sollicitudin enim, vestibulum mollis quam pretium ultrices. Quisque convallis, turpis eget ullamcorper consequat, justo leo vestibulum arcu, ut rutrum massa velit a orci. Sed et convallis neque. Donec laoreet orci at maximus iaculis. Mauris quis enim et ipsum mattis sodales. Etiam lacus felis, consectetur id semper eu, placerat eu odio. Ut consectetur lorem semper, interdum magna quis, tristique nisi. Nunc tempus a elit sed posuere. Proin sodales ornare tortor, sit amet ultricies ipsum pharetra et. Sed a nibh augue. Phasellus risus est, pharetra a lacus ut, placerat vulputate augue. Pellentesque volutpat tempor augue ac posuere. In vitae aliquam enim, ut auctor nibh. Mauris condimentum luctus placerat. Vivamus dapibus neque nisi, in facilisis nisi mattis ac.

Proin maximus, odio non interdum hendrerit, dolor lectus accumsan mauris, id semper neque est sed nulla. Pellentesque tortor velit, ultrices eu feugiat et, commodo nec tortor. Nulla non dui eleifend eros efficitur semper. Morbi suscipit euismod erat, eget accumsan elit commodo at. Maecenas sed lacus sit amet massa imperdiet molestie in at dui. Donec sit amet malesuada ante, lacinia sodales est. Aliquam pretium, felis id pellentesque consectetur, turpis justo sollicitudin tortor, sit amet convallis mi risus sed justo. Cras vulputate purus ac enim laoreet, eget pellentesque nisi malesuada.
```mechanics
move id="starforged/moves/adventure/face_danger" {
	add 1 "because I'm cool [[Ash Barlowe]]"
	roll "shadow" 1 3 1 9 9 // <statname> <action-die> <stat> <adds> <vs1> <vs2>
}
- "Oh nooo. This is gonna hurt. Time to [[Endure Harm]]. bla bla bla bla bla bla bla bla bla bla"
- "Another one here"
move "Endure Harm" {
    meter "health" from=3 to=2
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
progress "[[Defeat]] the enemiez" from-boxes=2 from-ticks=1 level="dangerous" steps=2
track "Qu*es*ts" from=12 to=18
xp 1 2
clock "The [[End]] Comes" from=1 to=2 out-of=4
```
And then a fight broke out!
```mechanics
move "Clash" {
    roll "iron" action=1 adds=0 stat=3 vs1=8 vs2=7
}
```

Oh no! Everyone is bloody! Our hero tries to talk some sense into them. They approach their counterparts and extend a hand.

"Let's solve this peacefully", our hero says.

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
```mechanics
- "line1"
- "line2"
- "multiline
string"
move "Do the Thing" {
  - "# Header"
  - "second thing"
  - "
### H3

This is part of

a single multiline string.
"
}
- "trailing"
- "here"
```