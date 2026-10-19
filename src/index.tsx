import '@fontsource/permanent-marker'
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { RootProviders } from "./providers";

document.getElementById('loading')?.remove()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootProviders>
      <App />
    </RootProviders>
  </StrictMode>,
);
