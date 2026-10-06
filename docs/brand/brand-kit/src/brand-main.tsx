import React from "react";
import { createRoot } from "react-dom/client";
import { BrandKit } from "./BrandKit";
import "./style.css";
import "./brand-kit.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrandKit />
  </React.StrictMode>,
);
