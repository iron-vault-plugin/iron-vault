export function breadthFirstTraversal<Leaf, Node>(
  root: Node,
  leaf: (node: Node) => Leaf | undefined,
  children: (node: Node) => Iterable<Node>,
): Leaf[] {
  const queue: Node[] = [];
  queue.push(root);

  let next: Node | undefined;
  const paths: Leaf[] = [];
  while ((next = queue.shift()) != null) {
    const leafVal = leaf(next);
    if (leafVal !== undefined) {
      paths.push(leafVal);
    } else {
      for (const child of children(next)) {
        queue.push(child);
      }
    }
  }
  return paths;
}
