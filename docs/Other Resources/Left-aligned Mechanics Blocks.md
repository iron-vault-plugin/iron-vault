By default, Iron Vault renders [[Mechanics Blocks]] as a small, centered box. Some players prefer them to be left-aligned and full-width. You can use [Obsidian's CSS Snippets](https://help.obsidian.md/snippets) feature to do this.

In an editor outside of Obsidian, create a file in `yourvault/.obsidian/snippets` called `ironvault-mechanics-left-align.css` and put the following in it:
   
```css
article.iron-vault-mechanics {
  max-width: initial;
  width: 100%;
}
```

Go to Settings > Appearance and then find CSS Snippets at the bottom. You should see `ironvault-mechanics-left-align` in the snippets list and if you turn it on, you should get full width, left-aligned mechanics nodes!