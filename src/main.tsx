import "./theme/tokens.css";
import "./theme/editor.css";
import "./theme/prose.css";
import "./theme/editor-content.css";
import "./theme/print.css";
import { loadTheme } from "./theme/themeStore";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Apply persisted theme before first paint to avoid a flash of the wrong mode.
loadTheme();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
