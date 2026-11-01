import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { ponteLocal } from "./servidor/ponte.ts";
import { readFileSync } from "node:fs";

const POLITICA_SEGURANCA: string = JSON.parse(readFileSync(new URL("./src-tauri/tauri.conf.json", import.meta.url), "utf8")).app.security.csp;
const API_PUBLICA = (process.env.VITE_API_URL || "").trim().replace(/["<>]/g, "");

function politicaDeSeguranca(): Plugin {
  return {
    name: "niko-politica-seguranca",
    apply: "build",
    transformIndexHtml: (html) =>
      html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${POLITICA_SEGURANCA}" />\n    <meta name="referrer" content="no-referrer" />\n    <meta name="kyro-api-url" content="${API_PUBLICA}" />`),
  };
}

export default defineConfig(({ mode }) => {
  // A ponte roda no mesmo processo do Vite, por isso precisa receber também
  // as variáveis sem prefixo VITE_ do .env.local. Elas nunca entram no bundle.
  const env = loadEnv(mode, process.cwd(), "");
  for (const chave of ["KYRO_GATEWAY_URL", "VITE_GATEWAY_URL", "KYRO_GATEWAY_SECRET", "NIKO_GATEWAY_SECRET"]) {
    if (!process.env[chave] && env[chave]) process.env[chave] = env[chave];
  }
  return {
    cacheDir: "node_modules/.vite-niko",
    plugins: [react(), politicaDeSeguranca(), ponteLocal()],
    optimizeDeps: {
      include: [
        "pdfjs-dist",
        "@tauri-apps/api/app", "@tauri-apps/api/core", "@tauri-apps/api/event", "@tauri-apps/api/webviewWindow", "@tauri-apps/api/window",
        "@tauri-apps/plugin-autostart", "@tauri-apps/plugin-notification", "@tauri-apps/plugin-process", "@tauri-apps/plugin-updater",
      ],
    },
    server: { port: 5420, strictPort: false, host: "localhost" },
    preview: { port: 5421, host: "localhost" },
    build: { chunkSizeWarningLimit: 1500 },
  };
});
