import type { ConfiguracaoAderencias, PlanilhaAderencia, ResultadoAderencia } from "../modulos/escritorio/aderenciasTipos";
import { cabecalhosNiko, urlApi, useAuth, type UsuarioAutenticado } from "../estado/autenticacao";

export interface PreviaAderencia {
  imagem: string;
  texto: string;
  alertas: number;
  urgentes: number;
}

export interface ResultadoEnvioAderencia {
  previa: PreviaAderencia;
  resultado: ResultadoAderencia;
}

const CABECALHOS = { "x-niko": "1", "content-type": "application/json" };
const NATIVO = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
// No navegador, a execução e o agendamento pertencem ao VPS. O modo local fica
// restrito ao aplicativo nativo; VITE_ADERENCIAS_REMOTA=0 permite testes locais nativos.
export function aderenciasRemotas(usuario: Pick<UsuarioAutenticado, "perfil" | "roboAderencias"> | null = useAuth.getState().usuario): boolean {
  // O navegador nunca tem a ponte local. O sinal de teste só pode desligar o
  // VPS no aplicativo nativo, para que um build web não volte a chamar /ponte.
  return !NATIVO || (import.meta.env.VITE_ADERENCIAS_REMOTA !== "0" && (usuario?.perfil === "dono" || usuario?.roboAderencias === true));
}

function cabecalhosDaExecucao(usuario = useAuth.getState().usuario): Record<string, string> {
  if (!aderenciasRemotas(usuario)) return CABECALHOS;
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("kyro_token") : null;
  return {
    ...cabecalhosNiko(),
    "content-type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(usuario ? { "x-kyro-user-id": String(usuario.id) } : {}),
  };
}

async function pedir<T>(caminho: string, corpo?: unknown): Promise<T> {
  const usuario = useAuth.getState().usuario;
  const remoto = aderenciasRemotas(usuario);
  const prefixo = remoto ? (import.meta.env.DEV ? "/ponte/aderencias-remota" : urlApi("/api/aderencias")) : "/ponte/aderencias";
  const destino = remoto && !import.meta.env.DEV ? `${prefixo}?acao=${encodeURIComponent(caminho)}` : `${prefixo}/${caminho}`;
  const resposta = await fetch(destino, {
    method: corpo === undefined ? "GET" : "POST",
    headers: cabecalhosDaExecucao(usuario),
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const json = await resposta.json().catch(() => ({})) as T & { erro?: string };
  if (!resposta.ok) throw new Error(json.erro ?? `http_${resposta.status}`);
  return json;
}

export const aderenciasPonte = {
  estado: () => pedir<{ disponivel: boolean; navegador: boolean }>("estado"),
  configuracao: () => pedir<{ configuracao: ConfiguracaoAderencias }>("configuracao"),
  salvarConfiguracao: (configuracao: ConfiguracaoAderencias) => pedir<{ configuracao: ConfiguracaoAderencias }>("configuracao", { configuracao }),
  testar: (planilha: PlanilhaAderencia) => pedir<PreviaAderencia>("testar", { planilha }),
  enviar: (configuracao: ConfiguracaoAderencias, planilha: PlanilhaAderencia) => pedir<ResultadoEnvioAderencia>("enviar", { configuracao, planilha }),
  executar: (configuracao: ConfiguracaoAderencias, grupoId?: string) => pedir<{ resultado: ResultadoAderencia; previas: PreviaAderencia[] }>("executar", { configuracao, grupoId }),
};
