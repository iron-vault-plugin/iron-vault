Iron Vault supports multiple characters per vault, which means it's possible to play multiplayer campaigns. Each player can have a different "active" character, and their actions will be based around that character.

In order to play with multiple players, you will also need some method of synchronizing your vault across multiple machines. Currently, none of the available alternatives support showing cursors of other players, or true realtime sync. There's always a slight delay. Most offerings support some sort of conflict resolution/merging for when two players are editing the same note.

The following are the current tested options for cross-player synchronization:

### Obsidian Sync

[Obsidian Sync](https://obsidian.md/sync) is Obsidian's official sync product. It's a paid product, and all the players would need an active account in order to play. Subscriptions start at $4-$5/mo for one "hosted" vault per player (that is, one of each player can host a different campaign, since inviting others to your vault doesn't count against your limit), or $8-$10 for 10 vaults per player.

While it's a paid product, Obsidian Sync is the easiest to get working across platforms, and the most effective and fastest at synchronization.

Sharing a single Obsidian Sync account between all players and splitting the costs (or having one person shoulder them) is against Obsidian's terms of service, which prohibit account sharing.

It is likely Obsidian Sync will eventually support multiple cursors and more realtime document editing like in Google Docs. But it's not in the near-future roadmap.

### Self-hosted LiveSync

The [Self-hosted LiveSync](https://github.com/vrtmrz/obsidian-livesync) plugin is a cheaper alternative to native Obsidian Sync. It's not as smooth an experience, but is well documented as far as setting up the hosted server.

Like Obsidian Sync, it supports smart conflict merging if multiple players are editing the same note at the same time, and reasonably-fast live updates.

This solution is best for folks with some technical ability or experience, or those who are willing to take the time to learn and deal with unexpected issues.

### Remotely Save

The [Remotely Save](https://github.com/remotely-save/remotely-save) plugin is a viable alternative for synchronization, and can be fully free. Unfortunately, you either have to wait one minute for it to sync remote changes, or run a sync manually. This can be workable if you're, say, on a video call where a screen is being shared and don't need constant updates, for example if you have a single note taker.

You will still need some kind of cloud hosting service, and those often cost money. A dedicated account for OneDrive, though, is free and viable.