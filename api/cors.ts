import type { VercelRequest, VercelResponse } from "@vercel/node";

const ORIGENS_NATIVAS = new Set([
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "http://localhost",
  "http://127.0.0.1",
]);

function origemPublica(): string {
  const configurada = process.env.KYRO_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (configurada) return configurada;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : "";
}

export function origemCorsPermitida(origem: string): boolean {
  if (!origem) return true;
  return ORIGENS_NATIVAS.has(origem) || origem === origemPublica();
}

export function configurarCors(req: VercelRequest, res: VercelResponse): boolean {
  const origem = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const permitida = origemCorsPermitida(origem);
  if (permitida && origem) res.setHeader("Access-Control-Allow-Origin", origem);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Niko, X-Niko-Token, X-Niko-Cliente");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  return permitida;
}
