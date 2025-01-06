# Contributing to Iron Vault

Contributions are welcome! This is a community project and we're all players
and want to make the experience better. If there's something you'd like to see
that's missing, or that's different from what you'd like, please file an issue
or send in a PR!

Development discussions happen on GitHub in a [dedicated
thread](https://discord.com/channels/437120373436186625/1239381699507257354)
in the [Ironsworn Discord](https://discord.gg/xTxmR9UZTC)

## Development

To get set up with the project, clone the repo first (use `--recurse-submodules`
if you want the hot-reload plugin added, see below), then `pnpm i` (you have
to install `pnpm` specifically, yes). You can then build the production
version of the plugin with `pnpm build`.

To play around, you can run `pnpm dev`, which watches for code changes,
compiles, and then deploys into the test vault. You can open up the test-vault
in obsidian and, with the hot-reload plugin enabled, new updates will be
loaded automatically. The [hot-reload plugin](https://github.com/pjeby/hot-reload)
is added as a git submodule, so either use `git clone --recurse-submodules` or
run `git submodule update --init` if you already cloned the repo.

There is a `test-vault` included in the repo that can be used as a sandbox
during development.

### Deploying Docs

There is a `docs` vault in the repository that holds the sources for our
documentation. Whenever you update `docs`, you should `pnpm build`, then open
up the `docs` vault and use the "Export Vault to HTML" command.

This command should already be configured, but for the sake of documenting the
expected settings:

* The export should include all files/directories except `Support`.
* The target directory should be `/path/to/iron-vault/docs-built`.
* In the Webpage HTML Export Settings page:
  * Turn off "Graph View" under Page Features
  * Under "Asset Options":
    * Turn on "Make Offline Compatible" under
    * Turn off Svelte CSS
    * Include CSS from "Iron Vault"
  * Under "Metadata":
    * Public site URL should be `https://iron-vault-plugin.github.io/iron-vault/`
    * Author Name should be `Iron Vault Dev Team`
    * Vault Title should be `Iron Vault`
    * RSS Feed should be enabled
