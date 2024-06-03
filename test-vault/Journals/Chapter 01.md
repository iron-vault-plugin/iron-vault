I'm telling my story here.

Suddenly, a trap! Oh no!

#character 
> #character

[Testing](oracle:GivenName)

Proin maximus, odio non interdum hendrerit, dolor lectus accumsan mauris, id semper neque est sed nulla. Pellentesque tortor velit, ultrices eu feugiat et, commodo nec tortor. Nulla non dui eleifend eros efficitur semper. Morbi suscipit euismod erat, eget accumsan elit commodo at. Maecenas sed lacus sit amet massa imperdiet molestie in at dui. Donec sit amet malesuada ante, lacinia sodales est. Aliquam pretium, felis id pellentesque consectetur, turpis justo sollicitudin tortor, sit amet c4onvallis mi risus sed justo. Cras vulputate purus ac enim laoreet, eget pellentesque nisi malesuada.

> [!spoiler]- This is a secret
> Oh no I've been found!

Reglar link to [[Example Vow|the vow I swor3e]].
![[Test Clock]]

![[Example Vow]]
```mechanics
move id="starforged/moves/adventure/face_danger" {
	add 1 "because I'm cool [[Ash Barlowe]]"
	roll "shadow" 1 3 1 9 9 // <statname> <action-die> <stat> <adds> <vs1> <vs2>
	clock "[[Test Clock]]" status="added"
}
asset "[Empath](asset:Empath)" status="added"
impact "Permanently Harmed" "marked"
- "Oh nooo. This is gonna hurt. Time to [Endure Harm](move:EndureHarm). bla bla bla bla bla bla bla bla bla bla"
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
    progress-roll "Deep into the Vault" score=2 vs1=1 vs2=3
    progress-roll "Deep into the Vault" 2 1 3 // <name> <score> <vs1> <vs2>
}
move "[[Chapter 02]]" {
  - "**bold text** *italic* [[README]]"
}
progress "[[Defeat]] the enemiez" from-boxes=2 from-ticks=1 level="dangerous" steps=2
track "Qu*es*ts" from=12 to=18
xp 1 2
clock "[[Test Clock]]" from=1 to=2 out-of=4
- "Plain oracle, with nested oracle:"
oracle "[Character Name > Given Name](oracle:GivenName)" roll=34 result="Esana" {
  oracle "Something else" 2 "foo"
}
- "Oracle group:"
oracle-group "Character Name" /* No need to link */ {
  oracle "[Given Name](oracle:starforged/oracles/character/character_name/given_name)" roll=30 result="Eren"
  oracle "[Callsign](oracle:starforged/oracles/character/character_name/callsign)" roll=72 result="Rook"
  oracle "[Family Name](oracle:starforged/oracles/character/character_name/family_name)" roll=42 result="Bridger"
}
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
  oracle "foo" roll=40 result="anything?"
}
- "trailing"
- "here"
```

[Starship](asset:Starship)