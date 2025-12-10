import React from "react";
import ReactDOM from "react-dom/client";
import Support from "./Support";
import "@workspace/ui/styles/agent.css";
import { Toaster } from "@workspace/ui/components/sonner.tsx";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Support />
    <Toaster position="bottom-right" />
  </React.StrictMode>,
);
