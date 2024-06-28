New releases of Iron Vault may change how it represents different information present in your vault. The two main reasons for this are:

1. *Internal changes to how Iron Vault represents things*: For example, if we changed how we store the data on your character sheet
2. *Changes to the version of Datasworn used by Iron Vault*: As discussed in [[Rulesets and Homebrew]], Iron Vault relies on [Datasworn](https://github.com/rsek/datasworn) for both the internal representation of Ironsworn components and for the underlying data itself. This means that when major changes occur in Datasworn, your vault may need to be updated. In particular, if Datasworn changes the IDs for existing content, those ID references in your character sheet, journals, and more will need to be updated.

Whenever you open a vault with Iron Vault installed, Iron Vault will check your vault to determine if any migrations are needed. You can also trigger this check by running the "Check if vault data migration is needed" command.

> [!IMPORTANT] Unmigrated vaults
> Iron Vault is only designed to work with vaults compatible with the current release. Using Iron Vault commands on an unmigrated vault may have unpredictable results.

## Vault migration

When Iron Vault detects that your vault needs a migration, you will be prompted to generate a migration report:

![[Migration report prompt.png|400]]

If you choose yes, the plugin will generate a preview [[#Migration report]] which you can use to understand the changes it will make in your vault. If you are satisfied with the report, run the "Check if vault data migration is needed" command again and this time choose "no" for the report.

If you choose no, you will then see a new prompt, asking you if you wish to allow the migration:

![[Migration prompt.png|400]]

> [!WARNING] Back up your vault before attempting migration
> You should make a back up of your vault before running a migration. We design the migrations carefully and test them before release, but, because they can rewrite all files in your vault, you should keep a backup to guard against a migration causing data loss.

If you choose "yes", your vault will be migrated to the latest version. A [[#Migration report]] will be generated so you can see what changes were actually made to your vault.
### Migration report

Migration reports detail the changes made (or, in the case of previews, the changes that would be made) in a migration. You can review a preview log before 

> ![[Migration report.png|600]]

In this case, a Datasworn version change has changed the IDs used by various oracles, and the ids for these oracles are being updated to match the current version.