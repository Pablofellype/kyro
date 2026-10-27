import type { ConfiguracaoAderencias, PlanilhaAderencia, ResultadoAderencia } from "../modulos/escritorio/aderenciasTipos";
import { cabecalhosNiko, urlApi } from "../estado/autenticacao";

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
// restrito ao aplicativo nativo; VITE_ADERENCIAS_REMOTA=0 permite testes locais.
const EXECUCAO_REMOTA = !NATIVO && import.meta.env.VITE_ADERENCIAS_REMOTA !== "0";
const PREFIXO = EXECUCAO_REMOTA
  ? (import.meta.env.DEV ? "/ponte/aderencias-remota" : urlApi("/api/aderencias"))
  : "/ponte/aderencias";

function cabecalhosDaExecucao(): Record<string, string> {
  if (!EXECUCAO_REMOTA) return CABECALHOS;
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("kyro_token") : null;
  return {
    ...cabecalhosNiko(),
    "content-type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function pedir<T>(caminho: string, corpo?: unknown): Promise<T> {
  const destino = EXECUCAO_REMOTA && !import.meta.env.DEV
    ? `${PREFIXO}?acao=${encodeURIComponent(caminho)}`
    : `${PREFIXO}/${caminho}`;
  const resposta = await fetch(destino, {
    method: corpo === undefined ? "GET" : "POST",
    headers: cabecalhosDaExecucao(),
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
