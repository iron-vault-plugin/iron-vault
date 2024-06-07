By default, to comply with Obsidian plugin guidelines, the plugin logs relatively few messages to
the Javascript console.

If you are experience issues and/or you are developing the plugin, you may wish to increase the
verbosity of the logging. To do so, you can set the `logLevel` property on the API using the JS
console:

```javascript
IronVaultAPI.logLevel = "debug";
```

The level you set is stored in browser localStorage, so it is preserved across reloads.

Log levels follow the NPM standard and are:

- `error`
- `warn`
- `info` (default)
- `verbose`
- `debug`
- `silly`
