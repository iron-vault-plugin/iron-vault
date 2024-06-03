#### Spoiler Callouts

You can create spoiler callouts by using built-in callout syntax with `![spoiler]-` in the header.

For example:

```
> [!spoiler]- Chapter 9
> Everyone dies, sorry.
```

Will render with custom styling and icon, like so:

> [!spoiler]- Chapter 9
> Everyone dies, sorry.


#### Embed Tweaks

Sometimes, you want to inline game entities in other notes, but you want to avoid all the extra decoration that Obsidian usually adds to those links. Using the `iv-embed` modifier in your embed links can be used to hide all these details and make your embed look as if it's fully part of your note.

It's used like this: `![[My Progress Track|iv-embed]]`.

Compare:

![[Write the Docs]]

versus:

![[Write the Docs|iv-embed]]