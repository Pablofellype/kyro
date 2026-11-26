import type { ServicoId } from "../tipos";
import { conexaoRemovida } from "./disponibilidadeConexoes.ts";

const OCULTAS_DA_GERENCIA = new Set<ServicoId>([
  "github", "vercel", "railway", "supabase", "cloudflare", "resend", "n8n", "linear",
  "stripe", "cripto", "strava", "reddit", "discord",
]);

export function conexaoVisivelPara(usuario: { perfil: string } | null | undefined, servico: ServicoId): boolean {
  if (conexaoRemovida(servico) || usuario?.perfil === "visitante") return false;
  return usuario?.perfil !== "gerencia" || !OCULTAS_DA_GERENCIA.has(servico);
}
