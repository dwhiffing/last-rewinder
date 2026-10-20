import '@fontsource/asap-sharp/400.css'
import '@fontsource/asap-sharp/600.css'
import '@fontsource/asap-sharp/700.css'
import '@fontsource/permanent-marker'
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { preloadAllAssets } from "./entities/preloadAssets";
import { RootProviders } from "./providers";

preloadAllAssets().finally(() => {
  document.getElementById('loading')?.remove()
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootProviders>
      <App />
    </RootProviders>
  </StrictMode>,
);
