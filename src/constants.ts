/* How we refer to the plugin in block names, property names, etc. */
export const PLUGIN_SLUG = "iron-vault";

export function pluginPrefixed<N extends string>(
  name: N,
): `${typeof PLUGIN_SLUG}-${N}` {
  return `${PLUGIN_SLUG}-${name}`;
}

export const PLUGIN_KIND_FIELD = pluginPrefixed("kind");

export const BLOCK_TYPE__TRACK = pluginPrefixed("track");
export const BLOCK_TYPE__CLOCK = pluginPrefixed("clock");

export enum IronVaultKind {
  Character = "character",
  Clock = "clock",
  ProgressTrack = "progress",
}
