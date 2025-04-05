/** Given normalized paths, checks if root is an ancestor of child. */
export function childOfPath(root: string, child: string): boolean {
  return (
    root == "/" || child.startsWith(root.endsWith("/") ? root : root + "/")
  );
}

/** Checks if the root is the same as the child or an ancestor of the child */
export function atOrChildOfPath(root: string, child: string): boolean {
  return root === child || childOfPath(root, child);
}

/** Checks if root is a direct parent of child.  */
export function directChildOfPath(root: string, child: string): boolean {
  if (!childOfPath(root, child)) return false;
  const normalizedRoot = root.endsWith("/") ? root : root + "/";
  const normalizedChild = child.substring(normalizedRoot.length);
  return normalizedChild !== "" && normalizedChild.includes("/") === false;
}

/** Returns base folder of normalized path */
export function parentFolderOf(root: string): string {
  const parts = root.split("/");
  parts.pop();
  return parts.length == 0 ? "/" : parts.join("/");
}

/**
 * Gets the name of top-level parent of a file, relative to a root folder.
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

/**
 * Gets the full path of top-level parent of a file, relative to a root folder.
 * For example, if the root folder is "world" and the file path is "world/continent/country/city.md",
 * the top-level parent folder is "continent".
 * @param rootFolderPath path to the root folder
 * @param path path to the file
 * @returns the full path of top-level child containing the path, or null if the file is outside the root folder
 */
export function findTopLevelParentPath(
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
  return rootFolderPath + parts[0];
}
