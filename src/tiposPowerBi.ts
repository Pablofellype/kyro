export const POWER_BI_RELATORIO_LEGADO = "controle-custos-sap";

export interface RelatorioPowerBi {
  id: string;
  nome: string;
  url: string;
}

export function acessosPowerBiEfetivos(acessos: readonly string[] | null | undefined): readonly string[] {
  return acessos ?? [POWER_BI_RELATORIO_LEGADO];
}
