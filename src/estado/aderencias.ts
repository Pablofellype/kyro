import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";
import {
  CONFIGURACAO_ADERENCIAS_PADRAO,
  configuracaoAderenciasValida,
  grupoAderenciaValido,
  planilhaAderenciaValida,
  type ConfiguracaoAderencias,
  type GrupoAderencia,
  type PlanilhaAderencia,
  type ResultadoAderencia,
} from "../modulos/escritorio/aderenciasTipos";

interface EstadoAderencias extends ConfiguracaoAderencias {
  definir: (parcial: Partial<ConfiguracaoAderencias>) => void;
  adicionarGrupo: (grupo?: Partial<GrupoAderencia>) => string;
  atualizarGrupo: (id: string, parcial: Partial<GrupoAderencia>) => void;
  removerGrupo: (id: string) => void;
  adicionarPlanilha: (grupoId: string, planilha: PlanilhaAderencia) => void;
  atualizarPlanilha: (grupoId: string, id: string, parcial: Partial<PlanilhaAderencia>) => void;
  removerPlanilha: (grupoId: string, id: string) => void;
  registrarResultado: (grupoId: string, resultado: ResultadoAderencia) => void;
}

function novoId(prefixo: string) {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // Usa o fallback abaixo.
  }
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizarComGrupos(atual: EstadoAderencias, grupos: GrupoAderencia[]) {
  return configuracaoAderenciasValida({ ...atual, grupos });
}

export const useAderencias = create<EstadoAderencias>()(persist((set) => ({
  ...CONFIGURACAO_ADERENCIAS_PADRAO,
  definir: (parcial) => set((atual) => configuracaoAderenciasValida({ ...atual, ...parcial })),
  adicionarGrupo: (grupo = {}) => {
    const id = novoId("grupo");
    set((atual) => normalizarComGrupos(atual, [...atual.grupos, grupoAderenciaValido({ ...grupo, id }, id)].slice(0, 30)));
    return id;
  },
  atualizarGrupo: (id, parcial) => set((atual) => normalizarComGrupos(atual, atual.grupos.map((g) => g.id === id ? grupoAderenciaValido({ ...g, ...parcial }, id) : g))),
  removerGrupo: (id) => set((atual) => normalizarComGrupos(atual, atual.grupos.filter((g) => g.id !== id))),
  adicionarPlanilha: (grupoId, planilha) => set((atual) => normalizarComGrupos(atual, atual.grupos.map((g) => g.id === grupoId ? { ...g, planilhas: [...g.planilhas, planilhaAderenciaValida(planilha, planilha.id)].slice(0, 30) } : g))),
  atualizarPlanilha: (grupoId, id, parcial) => set((atual) => normalizarComGrupos(atual, atual.grupos.map((g) => g.id === grupoId ? { ...g, planilhas: g.planilhas.map((p) => p.id === id ? planilhaAderenciaValida({ ...p, ...parcial }, id) : p) } : g))),
  removerPlanilha: (grupoId, id) => set((atual) => normalizarComGrupos(atual, atual.grupos.map((g) => g.id === grupoId ? { ...g, planilhas: g.planilhas.filter((p) => p.id !== id) } : g))),
  registrarResultado: (grupoId, resultado) => set((atual) => normalizarComGrupos(atual, atual.grupos.map((g) => g.id === grupoId ? { ...g, ultimoResultado: resultado } : g))),
}), {
  name: chave("aderencias"),
  storage: armazenamento,
  version: 1,
  merge: (persistido, atual) => {
    const salvo = persistido && typeof persistido === "object" && "state" in persistido ? (persistido as { state?: unknown }).state : persistido;
    return { ...atual, ...configuracaoAderenciasValida(salvo) };
  },
}));

export function novoIdAderencia(): string {
  return novoId("planilha");
}

export function novaPlanilhaAderencia(): PlanilhaAderencia {
  return { ...planilhaAderenciaValida({}), id: novoIdAderencia(), nome: "" };
}
