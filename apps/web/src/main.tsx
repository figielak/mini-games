import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Dev } from "./Dev.tsx";
import "@fontsource-variable/geist-mono";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {import.meta.env.DEV && location.pathname === "/dev" ? <Dev /> : <App />}
  </StrictMode>,
);
