import type { AreaSistema, Rota } from "../../tipos";

export const ROTAS_PESSOAIS: Rota[] = ["inicio", "journal", "estudos", "financas", "metas", "calendario"];
export const ROTAS_EMPRESA: Rota[] = ["escritorio", "chat", "calendario", "conexoes", "whatsapp"];
export const ROTAS_COMPARTILHADAS: Rota[] = ["atualizacao", "ia", "consumo", "configuracoes"];
export const ROTULOS_PESSOAIS: Partial<Record<Rota, string>> = { journal: "Rotina", metas: "Objetivos" };
export const ROTULOS_EMPRESA: Partial<Record<Rota, string>> = { escritorio: "Coordenação" };
const ROTAS_TECNICAS_OCULTAS_NO_PESSOAL: Rota[] = ["atualizacao", "ia", "consumo"];

export function rotasDaArea(area: AreaSistema): Rota[] {
  return area === "empresa" ? ROTAS_EMPRESA : ROTAS_PESSOAIS;
}

export function rotaDisponivelNaArea(rota: Rota, area: AreaSistema): boolean {
  return rotasDaArea(area).includes(rota) || ROTAS_COMPARTILHADAS.includes(rota);
}

export function rotaVisivelNaArea(rota: Rota, area: AreaSistema): boolean {
  return rotaDisponivelNaArea(rota, area) && !(area === "pessoal" && ROTAS_TECNICAS_OCULTAS_NO_PESSOAL.includes(rota));
}

export function primeiraRotaDaArea(area: AreaSistema): Rota {
  return area === "empresa" ? "escritorio" : "inicio";
}
