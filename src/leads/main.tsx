import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { LeadsPage } from "./LeadsPage";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <LeadsPage />
    </StrictMode>,
  );
}
