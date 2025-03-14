/** Given normalized paths, checks if root is a parent of child. */
export function childOfPath(root: string, child: string): boolean {
  return root == "/" || child.startsWith(root + "/");
}

/** Returns base folder of normalized path */
export function parentFolderOf(root: string): string {
  const parts = root.split("/");
  parts.pop();
  return parts.length == 0 ? "/" : parts.join("/");
}

/**
 * Gets the top-level parent of a file, relative to a root folder.
 * For example, if the root folder is "world" and the file path is "world/continent/country/city.md",
 * the top-level parent folder is "continent".
 * @param rootFolderPath path to the root folder
 * @param path path to the file
 * @returns the top-level child containing the path, or null if the file is outside the root folder
 */
export function findTopLevelParent(
  rootFolderPath: string,
  path: string,
): string | undefined {
  if (!rootFolderPath.endsWith("/")) {
    rootFolderPath += "/";
  }
  if (!path.startsWith(rootFolderPath)) {
    return undefined;
  }
  const relativePath = path.substring(rootFolderPath.length);
  const parts = relativePath.split("/");
  return parts[0];
}
