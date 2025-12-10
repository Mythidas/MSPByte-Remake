import React from "react";
import ReactDOM from "react-dom/client";
import About from "./About.tsx";
import "@workspace/ui/styles/agent.css";
import { Toaster } from "@workspace/ui/components/sonner.tsx";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <About />
    <Toaster position="bottom-right" />
  </React.StrictMode>,
);
