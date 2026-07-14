import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LoadedPage } from "../state/types";
import type { Device } from "../devices";
import { useI18n } from "../i18n";
import { IconChevronRight, IconFolder, IconPage, IconPin, IconSearch } from "../shell/icons";
import { buildTree, pathToPage, type TreeNode } from "./tree";

export type PanelTab = "pages" | "devices";

export interface PagesPanelProps {
  pages: LoadedPage[];
  pageIndex: number;
  devices: Device[];
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  pinned: boolean;
  onTogglePin: () => void;
  /** Oculta el panel (colapsa a las pestañas laterales). */
  onHide: () => void;
  onSelectPage: (index: number) => void;
  onSelectDevice: (device: Device) => void;
}

/**
 * Panel derecho del modo esquemas: acordeón de páginas estilo EPLAN (árbol
 * con contador por nodo) y buscador de dispositivos, con pin para anclarlo.
 */
export function PagesPanel({
  pages,
  pageIndex,
  devices,
  tab,
  onTab,
  pinned,
  onTogglePin,
  onHide,
  onSelectPage,
  onSelectDevice,
}: PagesPanelProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");
  const tree = useMemo(() => buildTree(pages), [pages]);
  // Nodos colapsados; por defecto se expande solo el camino a la página activa.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const activeTrail = new Set(pathToPage(tree, pageIndex));
    const all = new Set<string>();
    const collect = (node: TreeNode) => {
      for (const child of node.children) {
        if (!activeTrail.has(child.path)) all.add(child.path);
        collect(child);
      }
    };
    collect(tree);
    return all;
  });

  // Al cambiar de página (p. ej. por referencia cruzada), expande su camino.
  useEffect(() => {
    const trail = pathToPage(tree, pageIndex);
    if (trail.length === 0) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const path of trail) next.delete(path);
      return next;
    });
  }, [tree, pageIndex]);

  const filteredPages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return null;
    return pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) =>
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

  const renderLeaf = (index: number, depth: number) => {
    const page = pages[index];
    return (
      <button
        key={page.path}
        className={`acc-leaf${index === pageIndex ? " active" : ""}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onSelectPage(index)}
      >
        <IconPage size={12} className="acc-icon" />
        <span className="title">{page.title}</span>
        {page.badge && <span className="badge">{page.badge}</span>}
      </button>
    );
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const isCollapsed = collapsed.has(node.path);
    return (
      <div key={node.path}>
        <button
          className="acc-node"
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={() => toggleNode(node.path)}
          aria-expanded={!isCollapsed}
        >
          <span className={`twisty${isCollapsed ? "" : " open"}`}>▸</span>
          <IconFolder size={13} className="acc-icon" />
          <span className="title">{node.label}</span>
          <span className="count mono">{node.count}</span>
        </button>
        {!isCollapsed && (
          <div className="acc-children">
            {node.children.map((child) => renderNode(child, depth + 1))}
            {node.pageIndices.map((index) => renderLeaf(index, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pages-panel-inner">
      <div className="panel-head">
        <button className={tab === "pages" ? "active" : ""} onClick={() => onTab("pages")}>
          {t("panel.pages")}
        </button>
        {devices.length > 0 && (
          <button className={tab === "devices" ? "active" : ""} onClick={() => onTab("devices")}>
            {t("panel.devices")}
          </button>
        )}
        <span className="grow" />
        <button
          className={`panel-tool${pinned ? " active" : ""}`}
          title={pinned ? t("panel.unpin") : t("panel.pin")}
          aria-label={pinned ? t("panel.unpin") : t("panel.pin")}
          onClick={onTogglePin}
        >
          <IconPin size={13} />
        </button>
        <button
          className="panel-tool"
          title={t("panel.hide")}
          aria-label={t("panel.hide")}
          onClick={onHide}
        >
          <IconChevronRight size={13} />
        </button>
      </div>

      {tab === "pages" && (
        <>
          <div className="panel-search">
            <IconSearch size={13} />
            <input
              type="search"
              placeholder={t("filter.placeholder", { count: pages.length })}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="panel-scroll">
            {filteredPages
              ? filteredPages.map(({ page, index }) => (
                  <button
                    key={page.path}
                    className={`acc-leaf${index === pageIndex ? " active" : ""}`}
                    style={{ paddingLeft: 12 }}
                    onClick={() => onSelectPage(index)}
                  >
                    <IconPage size={12} className="acc-icon" />
                    <span className="title">{page.title}</span>
                    {page.badge && <span className="badge">{page.badge}</span>}
                  </button>
                ))
              : (
                <>
                  {tree.children.map((child) => renderNode(child, 0))}
                  {tree.pageIndices.map((index) => renderLeaf(index, 0))}
                </>
              )}
            {filteredPages && filteredPages.length === 0 && (
              <div className="list-empty">{t("devices.none")}</div>
            )}
          </div>
          <div className="panel-foot">
            <span className="mono">
              {t("panel.pageOf", { n: pageIndex + 1, total: pages.length })}
            </span>
            <span className="grow" />
            <button
              className="pager"
              aria-label={t("panel.prev")}
              disabled={pageIndex <= 0}
              onClick={() => onSelectPage(pageIndex - 1)}
            >
              ‹
            </button>
            <button
              className="pager"
              aria-label={t("panel.next")}
              disabled={pageIndex >= pages.length - 1}
              onClick={() => onSelectPage(pageIndex + 1)}
            >
              ›
            </button>
          </div>
        </>
      )}

      {tab === "devices" && (
        <>
          <div className="panel-search">
            <IconSearch size={13} />
            <input
              type="search"
              placeholder={t("devices.placeholder", { count: devices.length })}
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
            />
          </div>
          <div className="panel-scroll">
            {filteredDevices.map((device) => (
              <button
                key={device.key}
                className="device-item"
                onClick={() => onSelectDevice(device)}
              >
                <span className="row">
                  <span className="title">{device.label}</span>
                  <span className="badge">{device.occurrences.length}×</span>
                </span>
                {device.crumb && <span className="crumb">{device.crumb}</span>}
              </button>
            ))}
            {filteredDevices.length === 0 && (
              <div className="list-empty">{t("devices.none")}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
