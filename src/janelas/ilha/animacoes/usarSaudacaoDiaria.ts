import { useEffect } from "react";
import { NATIVO, liberarSistemaInicial, tempoOciosoMs, versaoDoApp } from "../../../desktop/desktop";
import { useConfig, type Configuracoes } from "../../../estado/configuracoes";
import { primeiroNomeDaConta, useAuth } from "../../../estado/autenticacao";
import { useIlha } from "../../../estado/ilha";
import { useClaudeCode } from "../../../estado/claudeCode";
import { hojeISO } from "../../../utilitarios/datas";
import { T } from "../../../textos/textos";

const AUSENCIA_MS = 30 * 60_000;
const ATIVO_AGORA_MS = 60_000;
const INTERVALO_DA_VERIFICACAO_MS = 60_000;
const ESPERA_ANTES_DE_SAUDAR_MS = 700;
export const AUSENCIA_PARA_BOAS_VINDAS_MS = 2 * 60 * 60_000;

type UltimaSaudacao = Configuracoes["ultimaSaudacao"];

export function decidirSaudacaoAoAbrir(ultima: UltimaSaudacao, hoje: string, versao: string, usuarioId: number): { saudar: boolean; versaoNova?: string } {
  if (!ultima || (ultima.usuarioId !== undefined && ultima.usuarioId !== usuarioId)) return { saudar: true };
  if (ultima.versao !== versao) return { saudar: true, versaoNova: versao };
  return { saudar: ultima.usuarioId !== usuarioId || ultima.dia !== hoje };
}

export function voltouDepoisDeAusencia(lacunaMs: number, ociosoMs: number, jaAusente: boolean): { ausente: boolean; voltou: boolean } {
  const ausente = jaAusente || lacunaMs >= AUSENCIA_MS || ociosoMs >= AUSENCIA_MS;
  return ausente && ociosoMs <= ATIVO_AGORA_MS ? { ausente: false, voltou: true } : { ausente, voltou: false };
}

export type ReacaoAVolta = "saudar" | "boasVindas" | "nada" | "esperar";

/** O que fazer quando a pessoa volta ao PC: saudação completa no primeiro retorno do dia, um aviso curto depois de muito tempo fora, e nada que interrompa a ilha em uso. */
export function reagirAVolta(p: { jaSaudouHoje: boolean; ausenciaMs: number; naoPerturbe: boolean; ilhaEmUso: boolean }): ReacaoAVolta {
  if (p.naoPerturbe) return "nada";
  if (p.ilhaEmUso) return "esperar";
  if (!p.jaSaudouHoje) return "saudar";
  return p.ausenciaMs >= AUSENCIA_PARA_BOAS_VINDAS_MS ? "boasVindas" : "nada";
}

function esperarConfiguracoes(): Promise<void> {
  if (useConfig.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolver) => {
    const desligar = useConfig.persist.onFinishHydration(() => {
      desligar();
      resolver();
    });
  });
}

function ilhaEmUso() {
  return useIlha.getState().estado === "expandida" || useClaudeCode.getState().pedidos.length > 0;
}

export function usarSaudacaoDiaria(ligada: boolean) {
  const usuarioId = useAuth((s) => s.usuario?.id);
  useEffect(() => {
    if (usuarioId === undefined) return;
    let vivo = true;
    let versao = "";
    let ausente = false;
    let ausenteDesde = 0;
    let ultimaVerificacao = Date.now();
    let espera: number | undefined;
    let intervalo: number | undefined;

    const saudarAgora = (versaoNova?: string) => {
      if (!vivo || useAuth.getState().usuario?.id !== usuarioId) return;
      useConfig.getState().definir({ ultimaSaudacao: { dia: hojeISO(), versao, usuarioId } });
      useIlha.getState().saudar(versaoNova);
    };

    const verificarVolta = async () => {
      const agora = Date.now();
      const lacuna = agora - ultimaVerificacao;
      ultimaVerificacao = agora;
      const ocioso = NATIVO ? (await tempoOciosoMs()) ?? 0 : 0;
      const usuario = useAuth.getState().usuario;
      if (!vivo || usuario?.id !== usuarioId) return;
      const r = voltouDepoisDeAusencia(lacuna, ocioso, ausente);
      if (r.ausente && !ausente) ausenteDesde = lacuna >= AUSENCIA_MS ? agora - lacuna : agora - ocioso;
      ausente = r.ausente;
      if (!r.voltou) return;
      const cfg = useConfig.getState();
      const jaSaudouHoje = cfg.ultimaSaudacao?.usuarioId === usuarioId && cfg.ultimaSaudacao.dia === hojeISO();
      const reacao = reagirAVolta({ jaSaudouHoje, ausenciaMs: agora - ausenteDesde, naoPerturbe: cfg.naoPerturbe, ilhaEmUso: ilhaEmUso() });
      if (reacao === "esperar") {
        ausente = true;
        return;
      }
      if (reacao === "saudar") saudarAgora();
      if (reacao === "boasVindas") useIlha.getState().revelar({ texto: T.ilha.saudacao.deVolta(primeiroNomeDaConta(usuario)), tipo: "info", agente: cfg.agentes.favorito }, 4500);
    };

    void (async () => {
      await esperarConfiguracoes();
      versao = await versaoDoApp();
      if (!vivo) return;
      if (!ligada) {
        void liberarSistemaInicial();
        return;
      }
      const decisao = decidirSaudacaoAoAbrir(useConfig.getState().ultimaSaudacao, hojeISO(), versao, usuarioId);
      if (decisao.saudar) espera = window.setTimeout(() => saudarAgora(decisao.versaoNova), ESPERA_ANTES_DE_SAUDAR_MS);
      else void liberarSistemaInicial();
      intervalo = window.setInterval(() => void verificarVolta(), INTERVALO_DA_VERIFICACAO_MS);
    })();

    return () => {
      vivo = false;
      window.clearTimeout(espera);
      window.clearInterval(intervalo);
    };
  }, [ligada, usuarioId]);
}
