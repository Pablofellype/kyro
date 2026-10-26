import type { VercelRequest, VercelResponse } from "@vercel/node";
import { configurarCors } from "./cors.js";
import { getDb } from "../src/servicos/autenticacao.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurarCors(req, res)) return res.status(403).json({ ok: false, erro: "origem_nao_permitida" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, erro: "metodo_nao_permitido" });
  try {
    const sql = getDb();
    await sql`SELECT 1 AS ok`;
    return res.status(200).json({ ok: true, api: "ok", banco: "ok", data: new Date().toISOString() });
  } catch {
    return res.status(503).json({ ok: false, api: "ok", banco: "indisponivel", erro: "banco_indisponivel" });
  }
}
