import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { NATIVO, notificarWindows } from "../../desktop/desktop";
import { useAuth } from "../../estado/autenticacao";
import { useIlha } from "../../estado/ilha";
import { useInterface } from "../../estado/interface";
import { tocarSom } from "../../ponte/sons";
import type { SolicitacaoMaterialRecebida } from "../../servicos/inventarioIntegracao";
import { consultarAppsEmpresa, ErroAppsEmpresa } from "./catalogoAppsEmpresa";

export const FONTES_DE_NOTIFICACOES = [
  {
    id: "inventario",
    nome: "Solicitações de material",
    mensagem: (total: number) => total === 1
      ? "Chegou uma nova solicitação de material."
      : `Chegaram ${total} novas solicitações de material.`,
  },
] as const;

export const EVENTO_PREFERENCIAS_APPS = "kyro:preferencias-notificacoes-apps";
const INTERVALO_AVISOS_DA_ILHA_MS = 15_000;
const INTERVALO_AVISOS_DO_SISTEMA_MS = 60_000;
const INTERVALO_SEM_FONTE_MS = 300_000;

const ERROS_INVENTARIO: Record<string, string> = {
  inventario_token_ausente: "O token do inventário está faltando no backend do Kyro.",
  inventario_token_rejeitado: "O inventário rejeitou o token. Confira se o Kyro usa o mesmo valor da versão publicada do inventário.",
  inventario_resposta_invalida: "O inventário respondeu em um formato que o Kyro não conseguiu ler.",
  inventario_indisponivel: "O inventário está indisponível. Tente novamente em instantes.",
  acao_nao_encontrada: "A versão do servidor do Kyro ainda não oferece esta consulta.",
  http_404: "A versão do servidor do Kyro ainda não oferece esta consulta.",
};

export function erroDeNotificacaoApps(falha: unknown, alternativa: string) {
  return falha instanceof ErroAppsEmpresa && Object.hasOwn(ERROS_INVENTARIO, falha.message)
    ? ERROS_INVENTARIO[falha.message]
    : alternativa;
}

interface ContagemDeSolicitacoes {
  assinatura: string;
  total: number;
  corrigidas?: number;
}

export type NotificacaoRecebida = ContagemDeSolicitacoes & {
  recentes?: SolicitacaoMaterialRecebida[];
  ordensCorrigidas?: number[];
};

function totalDaContagem(contagem: ContagemDeSolicitacoes | undefined, atual: NotificacaoRecebida | undefined) {
  if (!contagem || !atual || contagem.assinatura !== atual.assinatura || !Number.isSafeInteger(contagem.total)) return 0;
  const diferenca = Math.max(0, (atual.corrigidas ?? 0) - (contagem.corrigidas ?? 0));
  const ajuste = atual.ordensCorrigidas
    ? atual.ordensCorrigidas.slice(contagem.corrigidas ?? 0).filter((ordem) => ordem <= contagem.total).length
    : diferenca;
  return Math.max(0, contagem.total - ajuste);
}

export function textoDaSolicitacaoDeMaterial(solicitacao: SolicitacaoMaterialRecebida) {
  const material = solicitacao.itens || solicitacao.tipo;
  const resumo = material.length > 155 ? `${material.slice(0, 152).trimEnd()}…` : material;
  const texto = solicitacao.solicitante
    ? `${solicitacao.solicitante} solicitou ${resumo || "material"}`
    : `Nova solicitação de material${resumo ? `: ${resumo}` : ""}`;
  return [texto, solicitacao.local, solicitacao.protocolo].filter(Boolean).join(" · ");
}

function detalheDaSolicitacao(solicitacao: SolicitacaoMaterialRecebida) {
  return [solicitacao.itens || solicitacao.tipo, solicitacao.local, solicitacao.protocolo].filter(Boolean).join(" · ");
}

type EstadoDaConsulta = {
  usuarioId: number;
  situacao: "consultando" | "conectado" | "inativo" | "erro";
  erro?: string;
  notificacao?: NotificacaoRecebida;
};
type AvisoDeMaterial = { texto: string; detalhe?: string };
const chaveDeVistos = (usuarioId: number) => `kyro:solicitacoes-material-vistas:${usuarioId}`;

export const useEstadoNotificacoesApps = create<{
  consultas: Record<string, EstadoDaConsulta | undefined>;
  vistos: Record<number, ContagemDeSolicitacoes | undefined>;
}>(() => ({ consultas: {}, vistos: {} }));

function registrarConsulta(fonte: string, consulta: EstadoDaConsulta) {
  useEstadoNotificacoesApps.setState(({ consultas }) => {
    const anterior = consultas[fonte];
    const manterAnterior = consulta.situacao !== "inativo" && anterior?.usuarioId === consulta.usuarioId;
    return { consultas: { ...consultas, [fonte]: { ...consulta, notificacao: consulta.notificacao ?? (manterAnterior ? anterior.notificacao : undefined) } } };
  });
}

export function solicitarConsultaAppsEmpresa() {
  window.dispatchEvent(new Event(EVENTO_PREFERENCIAS_APPS));
}

export function usarResumoDoInventario(confirmada?: NotificacaoRecebida | null) {
  const usuarioId = useAuth((s) => s.usuario?.id);
  const consulta = useEstadoNotificacoesApps((s) => s.consultas.inventario);
  const vistos = useEstadoNotificacoesApps((s) => usuarioId === undefined ? undefined : s.vistos[usuarioId]);
  const estado = consulta?.usuarioId === usuarioId ? consulta : undefined;
  const notificacao = estado?.notificacao ?? confirmada ?? undefined;
  const chave = usuarioId === undefined ? "" : chaveDeVistos(usuarioId);
  const lidas = useMemo(() => {
    if (vistos || usuarioId === undefined) return vistos;
    try {
      return (JSON.parse(localStorage.getItem(chave) ?? "null") as ContagemDeSolicitacoes | null) ?? undefined;
    } catch { return undefined; }
  }, [chave, usuarioId, vistos]);
  const total = notificacao?.total ?? 0;
  const totalVisto = totalDaContagem(lidas, notificacao);
  return {
    estado,
    total,
    novas: Math.max(0, total - totalVisto),
    totalVisto,
    recentes: notificacao?.recentes ?? [],
    marcarVistas() {
      if (!notificacao || usuarioId === undefined) return;
      const { assinatura, total, corrigidas } = notificacao;
      const contagem = { assinatura, total, corrigidas };
      useEstadoNotificacoesApps.setState(({ vistos: anteriores }) => ({ vistos: { ...anteriores, [usuarioId]: contagem } }));
      try { localStorage.setItem(chave, JSON.stringify(contagem)); } catch { /* Mantém a leitura em memória. */ }
    },
  };
}

function revelarNaIlha(aviso: AvisoDeMaterial) {
  const revelou = useIlha.getState().revelar({ ...aviso, tipo: "info", aba: "materiais" }, 10_000);
  if (revelou) void tocarSom("pop", "avisos");
  return revelou;
}

function lerContagem(chave: string): ContagemDeSolicitacoes | undefined {
  try {
    const contagem = JSON.parse(localStorage.getItem(chave) ?? "null") as ContagemDeSolicitacoes | null;
    if (contagem && typeof contagem.assinatura === "string" && Number.isSafeInteger(contagem.total) && contagem.total >= 0) return contagem;
  } catch { /* A janela também mantém a contagem em memória. */ }
  return undefined;
}

export function usarNotificacoesAppsEmpresa(janela: "sistema" | "ilha" = "sistema", mobile = false) {
  const usuarioId = useAuth((s) => s.usuario?.perfil === "dono" || s.usuario?.perfil === "gerencia" ? s.usuario.id : null);
  const token = useAuth((s) => s.token);

  useEffect(() => {
    useEstadoNotificacoesApps.setState({ consultas: {} });
    if (!token || usuarioId === null) return;
    const avisarNaIlha = !mobile && (!NATIVO || janela === "ilha");
    const entregues = new Map<string, ContagemDeSolicitacoes>();
    const chaveDaFonte = (fonte: string) => `kyro:notificacoes-apps:${usuarioId}:${fonte}`;
    const registrarEntrega = (chave: string, contagem: ContagemDeSolicitacoes) => {
      entregues.set(chave, contagem);
      if (!mobile) {
        try { localStorage.setItem(chave, JSON.stringify(contagem)); } catch { /* Mantém o registro em memória. */ }
      }
    };
    let consulta: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let repetir = false;
    let ativo = true;

    const atualizar = async () => {
      if (!ativo || (!NATIVO && document.hidden)) return;
      if (consulta) {
        repetir = true;
        return;
      }
      clearTimeout(timer);
      const atual = new AbortController();
      consulta = atual;
      let temFonteAtiva = false;
      try {
        for (const fonte of FONTES_DE_NOTIFICACOES) {
          const chave = chaveDaFonte(fonte.id);
          registrarConsulta(fonte.id, { usuarioId, situacao: "consultando" });
          try {
            const { notificacao } = await consultarAppsEmpresa<{ notificacao: NotificacaoRecebida | null }>("notificacoes", token, { fonte: fonte.id }, atual.signal);
            if (atual.signal.aborted) return;
            if (!notificacao) {
              if (mobile) entregues.delete(chave);
              registrarConsulta(fonte.id, { usuarioId, situacao: "inativo" });
              continue;
            }
            temFonteAtiva = true;
            if (!Number.isSafeInteger(notificacao.total) || notificacao.total < 0) throw new Error("total_invalido");
            registrarConsulta(fonte.id, { usuarioId, situacao: "conectado", notificacao });
            if (!NATIVO && document.hidden) continue;
            const { assinatura, total, corrigidas } = notificacao;
            const contagem = { assinatura, total, corrigidas };
            const totalEntregue = (destino: string) => Math.max(
              totalDaContagem(entregues.get(destino), notificacao),
              totalDaContagem(mobile ? undefined : lerContagem(destino), notificacao),
            );
            if (janela === "sistema") {
              const anterior = totalEntregue(chave);
              const quantidade = total - anterior;
              if (mobile && entregues.get(chave)?.assinatura !== assinatura) {
                // Carrega o histórico em silêncio na primeira consulta do celular.
                registrarEntrega(chave, contagem);
              } else if (quantidade > 0) {
                const aviso = fonte.mensagem(quantidade);
                const solicitacao = notificacao.recentes?.find((item) => item.ordem > anterior);
                const mensagem = !mobile && solicitacao ? `${textoDaSolicitacaoDeMaterial(solicitacao)}${quantidade > 1 ? ` (+${quantidade - 1})` : ""}` : aviso;
                useInterface.getState().avisar(mensagem, undefined, "info", mobile ? 4500 : 10_000);
                registrarEntrega(chave, contagem);
                if (NATIVO) void notificarWindows("Kyro · Inventário", aviso);
              }
            }
            if (avisarNaIlha) {
              // O rodapé e o Windows podem avisar antes da Ilha. Cada destino confirma a própria entrega.
              const chaveVisual = `${chave}:visual-ilha`;
              const vistos = useEstadoNotificacoesApps.getState().vistos[usuarioId] ?? lerContagem(chaveDeVistos(usuarioId));
              const anterior = Math.max(totalEntregue(chaveVisual), totalDaContagem(vistos, notificacao));
              const quantidade = total - anterior;
              if (quantidade <= 0) continue;
              const solicitacao = notificacao.recentes?.find((item) => item.ordem > anterior);
              const titulo = quantidade === 1 && solicitacao?.solicitante ? `${solicitacao.solicitante} solicitou material` : fonte.mensagem(quantidade);
              if (revelarNaIlha({ texto: titulo, detalhe: solicitacao && detalheDaSolicitacao(solicitacao) })) {
                registrarEntrega(chaveVisual, contagem);
              }
            }
          } catch (falha) {
            if (atual.signal.aborted) return;
            temFonteAtiva = true;
            registrarConsulta(fonte.id, {
              usuarioId,
              situacao: "erro",
              erro: erroDeNotificacaoApps(falha, "Não foi possível verificar as solicitações agora."),
            });
          }
        }
      } finally {
        consulta = undefined;
        if (ativo && repetir) {
          repetir = false;
          void atualizar();
        } else if (ativo) {
          const intervalo = temFonteAtiva && avisarNaIlha ? INTERVALO_AVISOS_DA_ILHA_MS
            : temFonteAtiva || janela === "ilha" ? INTERVALO_AVISOS_DO_SISTEMA_MS
            : INTERVALO_SEM_FONTE_MS;
          timer = setTimeout(() => void atualizar(), intervalo);
        }
      }
    };

    void atualizar();
    const renovar = () => { void atualizar(); };
    document.addEventListener("visibilitychange", renovar);
    window.addEventListener(EVENTO_PREFERENCIAS_APPS, renovar);
    if (avisarNaIlha && !NATIVO) window.addEventListener("focus", renovar);
    return () => {
      ativo = false;
      consulta?.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", renovar);
      window.removeEventListener(EVENTO_PREFERENCIAS_APPS, renovar);
      if (avisarNaIlha && !NATIVO) window.removeEventListener("focus", renovar);
    };
  }, [janela, mobile, token, usuarioId]);
}
