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
