import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { ProjectsProvider } from "./state/ProjectsContext";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/library.css";
import "./styles/schematic.css";
import "./styles/viewer3d.css";
import "./styles/project.css";
import "./styles/data.css";
import "./styles/mobile.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ProjectsProvider>
        <App />
      </ProjectsProvider>
    </I18nProvider>
  </StrictMode>
);
