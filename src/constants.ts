/* How we refer to the plugin in block names, property names, etc. */
export const PLUGIN_SLUG: string = "iron-vault";

export function pluginPrefixed(name: string): string {
  return `${PLUGIN_SLUG}-${name}`;
}

export const BLOCK_TYPE__TRACK = pluginPrefixed("track");
