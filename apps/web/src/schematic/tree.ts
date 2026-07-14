import type { LoadedPage } from "../state/types";

/** Nodo del árbol de estructura del proyecto (identificadores EPLAN). */
export interface TreeNode {
  label: string;
  path: string;
  children: TreeNode[];
  /** Páginas que cuelgan directamente de este nodo. */
  pageIndices: number[];
  /** Total de páginas bajo el nodo (incluidos descendientes). */
  count: number;
}

/**
 * Construye el árbol de estructura a partir de los identificadores
 * estructurados de las páginas (breadcrumb del manifest). La última parte del
 * breadcrumb es el propio nombre de página, así que la hoja cuelga del resto.
 */
export function buildTree(pages: LoadedPage[]): TreeNode {
  const root: TreeNode = { label: "", path: "", children: [], pageIndices: [], count: 0 };
  pages.forEach((page, index) => {
    const segments = page.breadcrumb.slice(0, -1);
    let node = root;
    node.count += 1;
    for (const segment of segments) {
      let child = node.children.find((c) => c.label === segment);
      if (!child) {
        child = {
          label: segment,
          path: `${node.path}/${segment}`,
          children: [],
          pageIndices: [],
          count: 0,
        };
        node.children.push(child);
      }
      node = child;
      node.count += 1;
    }
    node.pageIndices.push(index);
  });
  return root;
}

/** Rutas de los nodos ancestros de una página, para expandir el camino activo. */
export function pathToPage(root: TreeNode, pageIndex: number): string[] {
  const trail: string[] = [];
  const visit = (node: TreeNode): boolean => {
    if (node.pageIndices.includes(pageIndex)) return true;
    for (const child of node.children) {
      if (visit(child)) {
        trail.push(child.path);
        return true;
      }
    }
    return false;
  };
  visit(root);
  return trail;
}
