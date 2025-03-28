You can kick off the [[Campaigns/index|campaign]] creation process using the [[Create a new campaign]] command.

The command will create a folder and a file representing your campaign. You can use the campaign file as a home page for your campaign-- the important data for Iron Vault is stored in the frontmatter `ironvault` property. Use caution when editing the frontmatter and especially that property.

![[Create a new campaign modal.png|300]]

First, choose the options you'd like for your new campaign:

* **Campaign name**: the name of your campaign. This sets the file name of the campaign file (for easy linking) as well as the display name used by Iron Vault when referring to your campaign.
* **Folder**: the folder that will house your campaign. By default, this will match the **Campaign name** but you may choose a different path if you wish.
	* As noted in [[Campaigns/index|Campaigns]], you may not nest campaigns.
* **Playset**: the [[Campaigns/Playsets/index|Playset]] determines which rules are active and which content is available in your campaign. You may select a built-in playset for official content using the toggles displayed, or you may configure a [[Custom playsets|custom playset]].
* **Scaffold campaign**: when this option is enabled (recommended), the following files and folders will be created in addition to the campaign root and campaign index:
	* *Default entity folders*: folders will be created for [[Entities/index|Tracked Entities]] based on the defaults you chose in [[Settings#New game object defaults|the "New game object defaults" settings]].
	* *Truths*: a [[Truths]] file ready for you to select game truths
	* *Initial character*: finally, the [[Create new character]] modal will be shown, allowing you to create an initial character for your campaign.
* **Folders**
	* **Campaign content**: [[Rulesets and Homebrew#Custom Source Folders (experimental)|Custom content]] placed in this folder will be automatically included in your campaign playset. Use this to quickly include campaign-specific oracle arrays!

Once you're ready, click **Create** to create your campaign and optionally the scaffold. The campaign index file will be opened, which makes your new campaign as the [[Campaigns/index|active campaign]], allowing you to immediately use any [[Commands/index|commands]] that require an active campaign.