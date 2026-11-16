export interface FontePlanilhaGoogle { id: string; gid?: number }
export interface AbaPlanilhaGoogle { id: number; titulo: string; linhas: number; colunas: number }
export interface PreviaPlanilhaGoogle {
  abaId: number;
  aba: string;
  intervalo: string;
  valores: string[][];
  limitada: boolean;
}
export interface PlanilhaGoogle {
  id: string;
  titulo: string;
  link: string;
  abas: AbaPlanilhaGoogle[];
  previa: PreviaPlanilhaGoogle | null;
  erro: string | null;
}
export interface DadosPlanilhasGoogle { planilhas: PlanilhaGoogle[]; consultadoEm: string }
