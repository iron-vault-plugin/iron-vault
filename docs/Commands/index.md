---
title: About Commands
---
The following commands are supported:

```dataview
LIST rows.file.link
FROM "Commands"
WHERE file.name != "index"
FLATTEN tags
GROUP BY default(tags, "Other")
```

#### Journal Insertions

Many commands have some mechanical effect, but additionally "add a mechanics entry to your journal". Right now, the "current journal" is determined simply by whatever file you have open when the command was invoked. That means that if you're looking at an [[Entities/index|Entity]] file, the command result will get appended to that file, not your "actual" journal.

(Coming Soon)

Since the above can be a bit of a footgun, Iron Vault will eventually add a system for tagging or otherwise tracking what your _actual_ journals are, so that commands make a better effort of inserting their results.
