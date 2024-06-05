Clock blocks are used to represent Clocks, originally described in Starforged.

A Clock is composed of two parts: the number of segments, and the number of segments that are filled in so far.

[[Clocks|Clocks]] in Iron Vault are [[Entities/About|Entities]], and can only have one note per clock, since their data is stored in frontmatter. These clocks can be placed anywhere as long as they have the right metadata, which they require in order to render correctly. You can use [[Create a clock]] to generate these.

#### Example

The following file:

````
---
name: Destruction of Kresnik
segments: 6
progress: 2
tags:
  - incomplete
iron-vault-kind: clock
---
```iron-vault-clock
```
````

Will render a clock that looks like this:

![[Destruction of Kresnik]]

#### Interacting with the Clock Block

To edit the number of filled-in slices, simply click on the slice you want to fill up to. Clocks fill clockwise.

In order to zero-out your clock, first click on the first wedge until only that first wedge is filled, then click on it again to toggle it off, leaving the clock blank.