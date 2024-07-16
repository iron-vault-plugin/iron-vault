---
aliases:
  - campaign
  - active campaign
---
Iron Vault is organized around *campaigns*. A single vault can have many campaigns, and, even if you only plan to run a single campaign in your vault, you'll still create a single root campaign.

A _campaign_ is a folder (called the *campaign root folder*) with a _campaign index file_ in its root. All files (including those within subfolders) within the campaign root folder are considered part of the campaign. In particular, all [[Entities/index|Tracked Entities]] for a campaign, such as [[Characters]], [[Progress Tracks]], and [[Clocks]], must exist somewhere within the campaign root folder tree.

> [!IMPORTANT] Campaigns cannot be nested
> Because campaigns include all files underneath them, one campaign cannot be nested within another. If Iron Vault detects this situation, you will see an error message when you attempt to use most Iron Vault features.

To create a new campaign, use the [[Create a new campaign]] command. This will create a campaign index file in a new or existing folder you designate.
## Active campaign and active character

When you are viewing a file that is within a campaign, that campaign becomes the *active campaign*. The active campaign provides a context for many operations within Iron Vault, such as which progress tracks to list and what moves/oracles are available.

[[Characters#Active character|Active character]] is tracked per campaign, so when the active campaign switches, the active character will switch to the most recent active character within that campaign.

## Organizing your vault

 _If you only plan to use this vault for a single campaign_, you can create a campaign in the root folder. This is the simplest setup, as it means that everything in the vault will be part of that one campaign.

*If you plan to use this vault for multiple campaigns*, you need to give each campaign its own separate folder. There are a variety of ways to organize this:
* *Make each campaign a subfolder of the root folder*: this is the default setup for the plugin and avoids excessive nesting.
* *Make each campaign a subfolder of a "Campaigns" folder*: use this if you'd like to keep your top-level folder more organized.
* *Group your campaigns in some more complicated way*: you're free to organize your campaign folders however you wish, as long as you follow the rule that each campaign gets its own folder.