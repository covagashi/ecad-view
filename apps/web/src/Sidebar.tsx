import { useMemo, useState, type ReactNode } from "react";
import type { LoadedPage } from "./App";
import type { Device } from "./devices";
import { useI18n } from "./i18n";

type SidebarTab = "pages" | "tree" | "devices";

export interface SidebarProps {
  pages: LoadedPage[];
  pageIndex: number;
  devices: Device[];
  open: boolean;
  onSelectPage: (index: number) => void;
  onSelectDevice: (device: Device) => void;
}

/** Nodo del árbol de estructura del proyecto (identificadores EPLAN). */
interface TreeNode {
  label: string;
  path: string;
  children: TreeNode[];
  /** Páginas que cuelgan directamente de este nodo. */
  pageIndices: number[];
}

/**
 * Barra lateral del modo esquemas: lista plana de páginas con filtro, árbol
 * de estructura del proyecto (manifest.db) y buscador de dispositivos.
 */
export function Sidebar({ pages, pageIndex, devices, open, onSelectPage, onSelectDevice }: SidebarProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<SidebarTab>("pages");
  const [filter, setFilter] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTree(pages), [pages]);
  const hasTree = tree.children.length > 0;

  const filteredPages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = pages.map((page, index) => ({ page, index }));
    if (!q) return all;
    return all.filter(({ page }) =>
      `${page.title} ${page.breadcrumb.join(" ")} ${page.name}`.toLowerCase().includes(q)
    );
  }, [pages, filter]);

  const filteredDevices = useMemo(() => {
    const q = deviceFilter.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => `${d.label} ${d.crumb} ${d.key}`.toLowerCase().includes(q));
  }, [devices, deviceFilter]);

  const toggleNode = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const isCollapsed = collapsed.has(node.path);
    return (
      <div key={node.path}>
        <button
          className="tree-node"
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={() => toggleNode(node.path)}
        >
          <span className={`twisty${isCollapsed ? "" : " open"}`}>▸</span>
          <span className="title">{node.label}</span>
        </button>
        {!isCollapsed && (
          <>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {node.pageIndices.map((index) => renderLeaf(index, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const renderLeaf = (index: number, depth: number) => {
    const page = pages[index];
    return (
      <button
        key={page.path}
        className={`tree-leaf${index === pageIndex ? " active" : ""}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onSelectPage(index)}
      >
        <span className="title">{page.title}</span>
        {page.badge && <span className="badge">{page.badge}</span>}
      </button>
    );
  };

  return (
    <aside className={`sidebar${open ? " open" : ""}`}>
      <nav className="sidebar-tabs">
        <button className={tab === "pages" ? "active" : ""} onClick={() => setTab("pages")}>
          {t("sidebar.pages")}
        </button>
        {hasTree && (
          <button className={tab === "tree" ? "active" : ""} onClick={() => setTab("tree")}>
            {t("sidebar.tree")}
          </button>
        )}
        {devices.length > 0 && (
          <button className={tab === "devices" ? "active" : ""} onClick={() => setTab("devices")}>
            {t("sidebar.devices")}
          </button>
        )}
      </nav>

      {tab === "pages" && (
        <>
          <div className="search">
            <input
              type="search"
              placeholder={t("filter.placeholder", { count: pages.length })}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="page-list">
            {filteredPages.map(({ page, index }) => (
              <button
                key={page.path}
                className={`page-item${index === pageIndex ? " active" : ""}`}
                onClick={() => onSelectPage(index)}
              >
                <span className="row">
                  <span className="title">{page.title}</span>
                  {page.badge && <span className="badge">{page.badge}</span>}
                </span>
                {page.breadcrumb.length > 1 && (
                  <span className="crumb">{page.breadcrumb.slice(0, -1).join(" › ")}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "tree" && (
        <div className="page-list">
          {tree.children.map((child) => renderNode(child, 0))}
          {tree.pageIndices.map((index) => renderLeaf(index, 0))}
        </div>
      )}

      {tab === "devices" && (
        <>
          <div className="search">
            <input
              type="search"
              placeholder={t("devices.placeholder", { count: devices.length })}
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
            />
          </div>
          <div className="page-list">
            {filteredDevices.map((device) => (
              <button key={device.key} className="page-item" onClick={() => onSelectDevice(device)}>
                <span className="row">
                  <span className="title">{device.label}</span>
                  <span className="badge">{device.occurrences.length}×</span>
                </span>
                {device.crumb && <span className="crumb">{device.crumb}</span>}
              </button>
            ))}
            {filteredDevices.length === 0 && <div className="list-empty">{t("devices.none")}</div>}
          </div>
        </>
      )}
    </aside>
  );
}

/**
 * Construye el árbol de estructura a partir de los identificadores
 * estructurados de las páginas (breadcrumb del manifest). La última parte del
 * breadcrumb es el propio nombre de página, así que la hoja cuelga del resto.
 */
function buildTree(pages: LoadedPage[]): TreeNode {
  const root: TreeNode = { label: "", path: "", children: [], pageIndices: [] };
  pages.forEach((page, index) => {
    const segments = page.breadcrumb.slice(0, -1);
    let node = root;
    for (const segment of segments) {
      let child = node.children.find((c) => c.label === segment);
      if (!child) {
        child = { label: segment, path: `${node.path}/${segment}`, children: [], pageIndices: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.pageIndices.push(index);
  });
  return root;
}
