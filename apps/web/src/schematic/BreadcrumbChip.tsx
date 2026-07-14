export interface BreadcrumbChipProps {
  breadcrumb: string[];
}

/** Chip flotante con la ruta estructurada de la página actual. */
export function BreadcrumbChip({ breadcrumb }: BreadcrumbChipProps) {
  if (breadcrumb.length === 0) return null;
  const parents = breadcrumb.slice(0, -1);
  const leaf = breadcrumb[breadcrumb.length - 1];
  return (
    <div className="breadcrumb-chip">
      {parents.map((segment, i) => (
        <span key={i} className="seg">
          {segment}
          <span className="sep">›</span>
        </span>
      ))}
      <span className="leaf">{leaf}</span>
    </div>
  );
}
