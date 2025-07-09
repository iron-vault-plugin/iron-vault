The _Roll dice_ command allows you to roll an arbitrary dice expression (e.g., "2d6-1d4+2"). The dice are rolled according to your [[Settings#Dice|Dice settings]], and the result is recorded as a [[Mechanics Blocks#`dice-expr`|dice-expr mechanics node]] as in the example below:

```iron-vault-mechanics
dice-expr expr="3d6 - 1d4 - 1d6 + 3" result=2 {
    rolls 1 2 3 dice="3d6"
    rolls 1 dice="1d4"
    rolls 6 dice="1d6"
}
```

