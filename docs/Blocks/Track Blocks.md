Track blocks are used to represent Progress Tracks, a core Ironsworn and Starforged feature.

[[Progress Tracks]] in Iron Vault are [[About Entities|Entities]], and can only have one note per Track, since their data is stored in frontmatter. These Tracks can be placed anywhere as long as they have the right metadata, which they require in order to render correctly. You can use [[Create a progress track]] to generate these.
#### Example

The following file:

````
---
tags:
  - incomplete
iron-vault-kind: progress
track-type: Vow
complete: false
unbounded: false
name: I vow to write this documentation
progress: 28
rank: dangerous
---
```iron-vault-track
```
````

Will render a track that looks like this:

![[Write the Docs|iv-embed]]

#### Interacting with the Track Block

To mark progress on the vow, click on the `+` button. To remove progress, use the `-` button. If you want more fine-grained control over the number of ticks, such as removing only 2 ticks in a Dangerous track, you can click on the text field with the number of ticks and edit it. The number of ticks will be updated when you click away or press enter.