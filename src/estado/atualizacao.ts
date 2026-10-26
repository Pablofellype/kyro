import { create } from "zustand";
import { NATIVO, prepararAtualizacao } from "../desktop/desktop";
import { salvarAgora } from "../ponte/armazenamento";
import { tocarSom } from "../ponte/sons";
import { T } from "../textos/textos";
import { versaoMaisNova } from "../utilitarios/versoes";
import manifesto from "../../package.json";
import type { Update } from "@tauri-apps/plugin-updater";

type Fase = "nada" | "disponivel" | "baixando" | "instalando" | "erro";
type Verificacao = "nada" | "verificando" | "atualizado" | "sem_versoes" | "disponivel" | "erro";

interface EstadoAtualizacao {
  fase: Fase;
  verificacao: Verificacao;
  versaoAtual: string;
  ultimaVerificacao: string;
  automatica: boolean;
  versao: string;
  notas: string;
  progresso: number;
  erro: string;
  recuperacao: string;
  carregarVersao: () => Promise<void>;
  verificar: (manual?: boolean) => Promise<void>;
  instalar: () => Promise<void>;
  dispensar: () => void;
  limparRecuperacao: () => void;
}

let pendente: Update | null = null;
const ATRASO_DA_INSTALACAO_AUTOMATICA_MS = 2500;
const CHAVE_ATUALIZACAO_EM_ANDAMENTO = "kyro:atualizacao-em-andamento";

const URL_ULTIMA_RELEASE = "https://api.github.com/repos/Pablofellype/kyro/releases/latest";

async function lerUltimaRelease(): Promise<{ versao: string; notas: string }> {
  const resposta = await fetch(URL_ULTIMA_RELEASE, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) throw new Error(`github_http_${resposta.status}`);
  const release = await resposta.json() as { tag_name?: unknown; body?: unknown };
  const tag = typeof release.tag_name === "string" ? release.tag_name.replace(/^v/, "") : "";
  if (!/^\d+\.\d+\.\d+$/.test(tag)) throw new Error("release_invalida");
  return { versao: tag, notas: typeof release.body === "string" ? release.body : "" };
}

export const useAtualizacao = create<EstadoAtualizacao>()((set, get) => ({
  fase: "nada",
  verificacao: "nada",
  versaoAtual: manifesto.version,
  ultimaVerificacao: "",
  automatica: false,
  versao: "",
  notas: "",
  progresso: 0,
  erro: "",
  recuperacao: "",
  carregarVersao: async () => {
    if (!NATIVO) return;
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      const versaoAtual = await getVersion();
      let recuperacao = "";
      try {
        const alvo = localStorage.getItem(CHAVE_ATUALIZACAO_EM_ANDAMENTO);
        if (alvo && alvo !== versaoAtual) {
          recuperacao = `A atualização para a versão ${alvo} não foi confirmada. Você ainda pode usar esta versão e baixar o instalador manualmente.`;
        } else if (alvo === versaoAtual) {
          localStorage.removeItem(CHAVE_ATUALIZACAO_EM_ANDAMENTO);
        }
      } catch {
        recuperacao = "Não foi possível confirmar o resultado da última atualização.";
      }
      set({ versaoAtual, recuperacao });
    } catch {
      set({ versaoAtual: "", erro: T.atualizacao.versaoFalhou });
    }
  },
  verificar: async (manual = false) => {
    if ((!NATIVO && !manual) || get().verificacao === "verificando" || get().fase === "baixando" || get().fase === "instalando") return;
    set({ verificacao: "verificando", erro: "" });
    try {
      await get().carregarVersao();
      if (!get().versaoAtual) throw new Error("versao_indisponivel");
      const dados = await lerUltimaRelease();
      const anterior = pendente;
      pendente = null;
      await anterior?.close().catch(() => undefined);
      const ultimaVerificacao = new Date().toISOString();
      if (!dados.versao || !versaoMaisNova(dados.versao, get().versaoAtual)) {
        set({ fase: "nada", verificacao: dados.versao ? "atualizado" : "sem_versoes", automatica: false, versao: dados.versao, notas: dados.notas, ultimaVerificacao });
        return;
      }
      if (NATIVO) {
        try {
          const { check } = await import("@tauri-apps/plugin-updater");
          pendente = await check({ timeout: 15000 });
        } catch {
          pendente = null;
        }
      }
      if (pendente && get().fase !== "disponivel") void tocarSom("peek", "avisos");
      set({ fase: pendente ? "disponivel" : "nada", verificacao: "disponivel", automatica: Boolean(pendente), versao: pendente?.version ?? dados.versao, notas: pendente?.body ?? dados.notas, ultimaVerificacao });
      if (pendente && NATIVO && !manual) {
        const versaoPendente = pendente;
        window.setTimeout(() => {
          const atual = get();
          if (pendente !== versaoPendente || atual.fase !== "disponivel" || atual.verificacao !== "disponivel") return;
          void atual.instalar();
        }, ATRASO_DA_INSTALACAO_AUTOMATICA_MS);
      }
    } catch {
      set({ verificacao: "erro", erro: get().versaoAtual ? T.atualizacao.erroVerificacao : T.atualizacao.versaoFalhou });
    }
  },
  instalar: async () => {
    if (!pendente || get().verificacao === "verificando" || get().fase === "baixando" || get().fase === "instalando") return;
    set({ fase: "baixando", progresso: 0, erro: "" });
    let total = 0;
    let baixado = 0;
    let ponteParada = false;
    let etapa: "download" | "salvamento" | "instalacao" = "download";
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const recente = await check({ timeout: 15000 });
      if (!recente) throw new Error("atualizacao_sumiu");
      const anterior = pendente;
      pendente = recente;
      if (anterior !== recente) await anterior.close().catch(() => undefined);
      await pendente.download((e) => {
        if (e.event === "Started") total = e.data?.contentLength ?? 0;
        if (e.event === "Progress") {
          baixado += e.data?.chunkLength ?? 0;
          set({ progresso: total > 0 ? Math.min(0.99, baixado / total) : 0.5 });
        }
        if (e.event === "Finished") set({ fase: "instalando", progresso: 1 });
      });
      set({ fase: "instalando", progresso: 1 });
      void tocarSom("approve", "avisos");
      etapa = "salvamento";
      await salvarAgora();
      await prepararAtualizacao();
      ponteParada = true;
      etapa = "instalacao";
      try { localStorage.setItem(CHAVE_ATUALIZACAO_EM_ANDAMENTO, recente.version); } catch { /* diagnóstico opcional */ }
      await pendente.install();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (falha) {
      console.error(`atualizacao falhou na etapa ${etapa}`, falha);
      if (ponteParada) {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch().catch(() => undefined);
        return;
      }
      set({ fase: "erro", erro: etapa === "download" ? T.atualizacao.erroDownload : etapa === "salvamento" ? T.atualizacao.erroSalvamento : T.atualizacao.erroInstalacao });
      void tocarSom("error", "avisos");
    }
  },
  dispensar: () => set({ fase: "nada" }),
  limparRecuperacao: () => {
    try { localStorage.removeItem(CHAVE_ATUALIZACAO_EM_ANDAMENTO); } catch { /* armazenamento opcional */ }
    set({ recuperacao: "" });
  },
}));
