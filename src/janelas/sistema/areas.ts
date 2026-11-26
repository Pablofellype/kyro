import type { ItemBarra } from "../../estado/configuracoes";
import { podeAcessarRota, type PapelOrganizacional } from "../../servicos/permissoes";
import type { AreaSistema, Rota } from "../../tipos";
import { rotaLigada, type Funcao } from "../../utilitarios/funcoes";

export const ROTAS_PESSOAIS: Rota[] = ["inicio", "journal", "estudos", "financas", "metas", "calendario", "importados"];
export const ROTAS_NO_TOPO_EMPRESA: readonly Rota[] = ["escritorio", "calendario"];
export const ROTAS_EMPRESA: Rota[] = [...ROTAS_NO_TOPO_EMPRESA, "appsEmpresa", "powerBi", "planilhasEmpresa", "sults"];
// Atualização não aparece na barra lateral, mas continua acessível por Configurações > Sobre.
export const ROTAS_COMPARTILHADAS: Rota[] = ["atualizacao", "configuracoes", "conexoes", "whatsapp"];
export const ROTULOS_PESSOAIS: Partial<Record<Rota, string>> = { journal: "Rotina", metas: "Objetivos", calendario: "Calendário pessoal" };
export const ROTULOS_EMPRESA: Partial<Record<Rota, string>> = { appsEmpresa: "Sistemas", conexoes: "Conexões de trabalho" };

export function itensVisiveisDaBarra(barra: readonly ItemBarra[], area: AreaSistema, usuario: { perfil: PapelOrganizacional; roboAderencias?: boolean } | null, desligadas: readonly Funcao[]): ItemBarra[] {
  const visiveis = barra.filter((item) => item.visivel && rotaLigada(item.rota, desligadas) && rotaVisivelNaArea(item.rota, area) && podeAcessarRota(usuario, item.rota, area));
  if (area === "pessoal") return visiveis;
  const ordenados = [
    ...ROTAS_NO_TOPO_EMPRESA.flatMap((rota) => visiveis.filter((item) => item.rota === rota)),
    ...visiveis.filter((item) => !ROTAS_NO_TOPO_EMPRESA.includes(item.rota)),
  ];
  const planilhas = ordenados.findIndex((item) => item.rota === "planilhasEmpresa");
  if (planilhas >= 0 && ordenados.some((item) => item.rota === "powerBi")) {
    const [item] = ordenados.splice(planilhas, 1);
    ordenados.splice(ordenados.findIndex((i) => i.rota === "powerBi") + 1, 0, item);
  }
  return ordenados;
}

export function rotasDaArea(area: AreaSistema): Rota[] {
  return area === "empresa" ? ROTAS_EMPRESA : ROTAS_PESSOAIS;
}

export function rotaDisponivelNaArea(rota: Rota, area: AreaSistema): boolean {
  return rotasDaArea(area).includes(rota) || ROTAS_COMPARTILHADAS.includes(rota);
}

export function rotaVisivelNaArea(rota: Rota, area: AreaSistema): boolean {
  return rotaDisponivelNaArea(rota, area);
}

export function primeiraRotaDaArea(area: AreaSistema): Rota {
  return area === "empresa" ? "escritorio" : "inicio";
}
