import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";
import {
  CONFIGURACAO_ADERENCIAS_PADRAO,
  configuracaoAderenciasValida,
  planilhaAderenciaValida,
  type ConfiguracaoAderencias,
  type PlanilhaAderencia,
  type ResultadoAderencia,
} from "../modulos/escritorio/aderenciasTipos";

interface EstadoAderencias extends ConfiguracaoAderencias {
  definir: (parcial: Partial<ConfiguracaoAderencias>) => void;
  adicionar: (planilha: PlanilhaAderencia) => void;
  atualizar: (id: string, parcial: Partial<PlanilhaAderencia>) => void;
  remover: (id: string) => void;
  registrarResultado: (resultado: ResultadoAderencia) => void;
}

export const useAderencias = create<EstadoAderencias>()(persist((set) => ({
  ...CONFIGURACAO_ADERENCIAS_PADRAO,
  definir: (parcial) => set((atual) => configuracaoAderenciasValida({ ...atual, ...parcial })),
  adicionar: (planilha) => set((atual) => ({ planilhas: [...atual.planilhas, planilhaAderenciaValida(planilha, planilha.id)].slice(0, 30) })),
  atualizar: (id, parcial) => set((atual) => ({ planilhas: atual.planilhas.map((p) => p.id === id ? planilhaAderenciaValida({ ...p, ...parcial }, id) : p) })),
  remover: (id) => set((atual) => ({ planilhas: atual.planilhas.filter((p) => p.id !== id) })),
  registrarResultado: (resultado) => set({ ultimoResultado: resultado }),
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
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // Usa o fallback abaixo.
  }
  return `planilha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function novaPlanilhaAderencia(): PlanilhaAderencia {
  return { ...planilhaAderenciaValida({}), id: novoIdAderencia(), nome: "" };
}
