import type { ConfiguracaoAderencias, PlanilhaAderencia, ResultadoAderencia } from "../modulos/escritorio/aderenciasTipos";
import type { RascunhoAderencias } from "../modulos/escritorio/edicaoAderencias";
import { cabecalhosNiko, urlApi, useAuth, type UsuarioAutenticado } from "../estado/autenticacao";
import type { AgendadaWhatsapp } from "./whatsapp";

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

export type FrequenciaMensagemAderencia = "once" | "daily" | "weekly";
export interface AgendamentoMensagemAderencia {
  jid: string;
  texto: string;
  quando: string;
  fuso: string;
  frequencia: FrequenciaMensagemAderencia;
  dias: number[];
  todos: boolean;
  numeros: string[];
}
export interface MensagensAutomaticasAderencia {
  grupos: Array<{ jid: string; nome: string }>;
  agendadas: Array<AgendadaWhatsapp & { frequencia: string; dias: number[]; fuso: string }>;
}

const CABECALHOS = { "x-niko": "1", "content-type": "application/json" };
const NATIVO = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
// No navegador, a execução e o agendamento pertencem ao VPS. O modo local fica
// restrito ao aplicativo nativo; VITE_ADERENCIAS_REMOTA=0 permite testes locais nativos.
export function aderenciasRemotas(usuario: Pick<UsuarioAutenticado, "perfil" | "roboAderencias"> | null = useAuth.getState().usuario): boolean {
  // O navegador nunca tem a ponte local. O sinal de teste só pode desligar o
  // VPS no aplicativo nativo, para que um build web não volte a chamar /ponte.
  return !NATIVO || (import.meta.env.VITE_ADERENCIAS_REMOTA !== "0" && (usuario?.perfil === "dono" || (usuario?.perfil === "gerencia" && usuario.roboAderencias === true)));
}

function cabecalhosDaExecucao(usuario = useAuth.getState().usuario): Record<string, string> {
  if (!aderenciasRemotas(usuario)) return { ...CABECALHOS, ...cabecalhosNiko() };
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("kyro_token") : null;
  return {
    ...cabecalhosNiko(),
    "content-type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(usuario ? { "x-kyro-user-id": String(usuario.id) } : {}),
  };
}

async function pedir<T>(caminho: string, corpo?: unknown, signal?: AbortSignal): Promise<T> {
  const { usuario, token } = useAuth.getState();
  const remoto = aderenciasRemotas(usuario);
  const prefixo = remoto ? (import.meta.env.DEV ? "/ponte/aderencias-remota" : urlApi("/api/aderencias")) : "/ponte/aderencias";
  const destino = remoto && !import.meta.env.DEV ? `${prefixo}?acao=${encodeURIComponent(caminho)}` : `${prefixo}/${caminho}`;
  const resposta = await fetch(destino, {
    method: corpo === undefined ? "GET" : "POST",
    headers: {
      ...cabecalhosDaExecucao(usuario),
      ...(caminho === "mensagens-automaticas" && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal,
  });
  const json = await resposta.json().catch(() => ({})) as T & { erro?: string };
  if (!resposta.ok) throw new Error(json.erro ?? `http_${resposta.status}`);
  return json;
}

export const aderenciasPonte = {
  estado: () => pedir<{ disponivel: boolean; navegador: boolean }>("estado"),
  configuracao: (signal?: AbortSignal) => pedir<{ configuracao: ConfiguracaoAderencias }>("configuracao", undefined, signal),
  salvarRotina: (rascunho: RascunhoAderencias) => pedir<{ configuracao: ConfiguracaoAderencias }>("salvar-rotina", { rascunho }),
  registrarResultado: (grupoId: string, resultado: ResultadoAderencia) => pedir<{ configuracao: ConfiguracaoAderencias }>("registrar-resultado", { grupoId, resultado }),
  testar: (planilha: PlanilhaAderencia) => pedir<PreviaAderencia>("testar", { planilha }),
  enviar: (grupoId: string, planilha: PlanilhaAderencia, configuracao?: ConfiguracaoAderencias) => pedir<ResultadoEnvioAderencia>("enviar", { grupoId, configuracao, planilha }),
  executar: (grupoId: string, configuracao?: ConfiguracaoAderencias) => pedir<{ resultado: ResultadoAderencia; previas: PreviaAderencia[] }>("executar", { grupoId, configuracao }),
  mensagensAutomaticas: (signal?: AbortSignal) => pedir<MensagensAutomaticasAderencia>("mensagens-automaticas", undefined, signal),
  participantes: (jid: string, signal?: AbortSignal) => pedir<{ participantes: Array<{ numero: string; nome: string }> }>("mensagens-automaticas", { operacao: "participantes", jid }, signal),
  agendarMensagem: (agenda: AgendamentoMensagemAderencia) => pedir<{ id: string }>("mensagens-automaticas", { operacao: "agendar", ...agenda }),
  cancelarMensagem: (id: string) => pedir<{ ok: true }>("mensagens-automaticas", { operacao: "cancelar", id }),
};
