import { useI18n, LOCALES, LOCALE_NAMES, type Locale } from "../i18n";
import { useProjects } from "../state/ProjectsContext";
import { useTheme } from "../theme";
import { useWakeLock } from "../wakeLock";
import { languageName, resolveAmlLang } from "../data/lang";
import { IconMoon, IconSun } from "./icons";

export interface SettingsPanelProps {
  /** Se llama tras una acción que deba cerrar el popover/hoja. */
  onClose?: () => void;
  /** Muestra el conmutador de tema (en móvil no existe el botón del rail). */
  showTheme?: boolean;
}

/**
 * Contenido de Ajustes: idioma, (tema), ficheros de ejemplo, enlaces,
 * privacidad y versión. Lo comparten el popover del rail (escritorio) y la
 * hoja inferior de móvil.
 */
export function SettingsPanel({ onClose, showTheme = false }: SettingsPanelProps) {
  const { t, locale, setLocale } = useI18n();
  const { state, dispatch, active: doc, openDemo } = useProjects();
  const { theme, toggleTheme } = useTheme();
  const wakeLock = useWakeLock();
  const busy = state.projects.some((p) => p.loading);
  // Idioma del proyecto activo (textos multiidioma del AML), si lo hay.
  const aml = doc?.aml ?? null;
  const amlLang = resolveAmlLang(aml, doc?.amlLang, locale);

  return (
    <>
      <label className="rail-pop-row">
        <span>{t("rail.language")}</span>
        <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
      </label>

      {doc && aml && aml.languages.length > 0 && (
        <label className="rail-pop-row data-lang">
          <span>{t("data.language")}</span>
          <select
            value={amlLang}
            onChange={(e) => dispatch({ type: "SET_AML_LANG", id: doc.id, lang: e.target.value })}
          >
            <option value="">{t("data.langOriginal")}</option>
            {aml.languages.map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
              </option>
            ))}
          </select>
        </label>
      )}

      {showTheme && (
        <>
          <div className="rail-pop-sep" />
          <button className="rail-pop-action" onClick={toggleTheme}>
            {theme === "dark" ? <IconSun size={13} /> : <IconMoon size={13} />}{" "}
            {t("rail.theme")}
          </button>
        </>
      )}

      {wakeLock.supported && (
        <>
          <div className="rail-pop-sep" />
          <div className="rail-pop-title">{t("settings.display")}</div>
          <button
            className="rail-pop-row toggle-row"
            role="switch"
            aria-checked={wakeLock.enabled}
            onClick={wakeLock.toggle}
          >
            <span>{t("settings.keepAwake")}</span>
            <span className={"switch" + (wakeLock.enabled ? " on" : "")} aria-hidden="true">
              <span className="switch-knob" />
            </span>
          </button>
        </>
      )}

      <div className="rail-pop-sep" />
      <div className="rail-pop-title">{t("settings.samples")}</div>
      <button
        className="rail-pop-action"
        disabled={busy}
        onClick={() => {
          onClose?.();
          void openDemo("/demo/ejemplo.epdz");
        }}
      >
        {t("drop.demoProject")}
      </button>
      <button
        className="rail-pop-action"
        disabled={busy}
        onClick={() => {
          onClose?.();
          void openDemo("/demo/pilz_pnoz_3d.e3d");
        }}
      >
        {t("drop.demoPart")}
      </button>

      <div className="rail-pop-sep" />
      <div className="rail-pop-title">{t("settings.links")}</div>
      <a
        className="rail-pop-action"
        href="https://github.com/covagashi/ecad-view"
        target="_blank"
        rel="noreferrer"
      >
        GitHub<span className="ext">↗</span>
      </a>
      <a className="rail-pop-action" href="https://covaga.dev" target="_blank" rel="noreferrer">
        covaga.dev<span className="ext">↗</span>
      </a>
      <a className="rail-pop-action" href="privacy.html" target="_blank" rel="noreferrer">
        {t("settings.privacy")}
        <span className="ext">↗</span>
      </a>

      <div className="rail-pop-version mono">Covaga ECAD Viewer · v{__APP_VERSION__}</div>
    </>
  );
}
