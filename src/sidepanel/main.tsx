import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { SidePanelApp } from "./SidePanelApp";

window.addEventListener("error", (event) => {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `<div style="padding:12px;color:#fecaca;background:#450a0a;font:12px system-ui;">
    LeadBrief runtime error: ${String(event.error?.message ?? event.message)}
  </div>`;
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SidePanelApp />
    </StrictMode>,
  );
}
