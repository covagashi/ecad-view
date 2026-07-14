import type { SVGProps } from "react";

/*
 * Iconos de línea 16×16 del rediseño (trazo currentColor). Sin dependencias:
 * el conjunto procede de los mockups del proyecto de diseño.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return { width: size, height: size, viewBox: "0 0 16 16", fill: "none", ...props };
}

/** Rayo de la marca (relleno, se usa sobre fondo acento). */
export function IconBolt(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 1L3 9h4l-1 6 7-9H8l1-5z" fill="currentColor" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 7l6-5 6 5v7H9v-4H7v4H2V7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCube(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 1l6 3.5v7L8 15l-6-3.5v-7L8 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 8l6-3.5M8 8L2 4.5M8 8v7" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function IconSchematic(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 6h6M5 9h6M5 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7v4M8 5v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2L3.1 3.1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13.5 9.5A6 6 0 116.5 2.5a5 5 0 007 7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8l.9 1.9 2.1.3 1.5-1 .9 1.6-1 1.5.8 2-1.9.9-.3 2.1 1 1.5-1.6.9-1.5-1-2 .8-.9-1.9-2.1-.3-1.5 1-.9-1.6 1-1.5-.8-2 1.9-.9.3-2.1-1-1.5 1.6-.9 1.5 1 2-.8z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M1.5 4a1 1 0 011-1h3.6l1.5 1.8h6a1 1 0 011 1V12a1 1 0 01-1 1h-11a1 1 0 01-1-1V4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPage(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="2" width="11" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 5.5h6M5 8h6" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M9.5 1.5l5 5-2.2.7-2.8 2.8.3 2.5-1.6 1.6-3-3L2 14.3 1.7 14l3.2-3.2-3-3L3.5 6.2 6 6.5l2.8-2.8.7-2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconFit(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Órbita (herramienta 3D). */
export function IconOrbit(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="8" cy="8" rx="5.5" ry="2.2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Desplazamiento / pan (herramienta 3D). */
export function IconPan(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M6 4l2-2 2 2M6 12l2 2 2-2M4 6L2 8l2 2M12 6l2 2-2 2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Aislar pieza (dos rectángulos enlazados). */
export function IconIsolate(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 9L9 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
