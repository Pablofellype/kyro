export const CONEXOES_REMOVIDAS = ["outlook", "teams", "planner", "planilhas"] as const;

export function conexaoRemovida(servico: string): servico is typeof CONEXOES_REMOVIDAS[number] {
  return (CONEXOES_REMOVIDAS as readonly string[]).includes(servico);
}

export function conexaoEmTestes(servico: string): boolean {
  return servico === "google";
}

export function exigirConexaoDisponivel(servico: string): void {
  if (conexaoEmTestes(servico)) throw new Error("conexao_em_testes");
}
