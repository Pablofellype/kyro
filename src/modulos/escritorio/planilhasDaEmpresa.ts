import type { ConfiguracaoAderencias } from "./aderenciasTipos.ts";

export interface PlanilhaDaEmpresa {
  id: string;
  nome: string;
  url: string;
  previa: string;
}

export interface PlanilhaCadastrada extends PlanilhaDaEmpresa {
  origemRobo: boolean;
  ativa: boolean;
}

export type AjustePlanilha = PlanilhaCadastrada | { id: string; oculta: true; documento?: string };

export type AlteracaoPlanilha =
  | { acao: "adicionar" | "salvar"; id: string; origemRobo: boolean; nome: string; url: string; ativa: boolean }
  | { acao: "remover"; id: string; origemRobo: boolean };

const GOOGLE_PLANILHAS = "https://docs.google.com";
const ROTA_PLANILHA = /^\/spreadsheets\/(?:u\/\d+\/)?d\/([\w-]{1,200})(?:\/|$)/;

export function planilhaPeloLink(nome: string, endereco: string): PlanilhaDaEmpresa | null {
  try {
    if (endereco.length > 4096) return null;
    const url = new URL(endereco);
    const documento = ROTA_PLANILHA.exec(url.pathname)?.[1];
    if (url.origin !== GOOGLE_PLANILHAS || url.username || url.password || !documento || documento === "e") return null;
    url.pathname = `/spreadsheets/d/${documento}/edit`;
    url.searchParams.delete("gid");
    url.searchParams.delete("range");
    url.hash = "";
    const previa = new URL(`/spreadsheets/d/${documento}/preview`, GOOGLE_PLANILHAS);
    const chave = url.searchParams.get("resourcekey");
    if (chave) previa.searchParams.set("resourcekey", chave);
    return { id: documento, nome, url: url.href, previa: previa.href };
  } catch {
    return null;
  }
}

export function planilhasDasAderencias(config: Pick<ConfiguracaoAderencias, "grupos" | "planilhas">): PlanilhaDaEmpresa[] {
  const itens = config.grupos.length ? config.grupos.flatMap((grupo) => grupo.planilhas) : config.planilhas;
  const unicas = new Map<string, PlanilhaDaEmpresa>();
  for (const item of itens) {
    const arquivo = planilhaPeloLink(item.nome, item.sheetUrl);
    if (arquivo && !unicas.has(arquivo.id)) unicas.set(arquivo.id, arquivo);
  }
  return [...unicas.values()];
}

export function combinarPlanilhas(originais: readonly PlanilhaDaEmpresa[], ajustes: readonly AjustePlanilha[], dono: boolean): PlanilhaCadastrada[] {
  const origens = new Set(originais.map(({ id }) => id));
  const alterados = new Set(ajustes.map(({ id }) => id));
  const cadastros = ajustes.filter((item): item is PlanilhaCadastrada =>
    !("oculta" in item) && (dono || (item.ativa && (!item.origemRobo || origens.has(item.id)))));
  const documentos = new Set(ajustes.map((item) => "oculta" in item ? item.documento : planilhaPeloLink(item.nome, item.url)?.id));
  const originaisDisponiveis: PlanilhaCadastrada[] = originais
    .filter(({ id }) => !alterados.has(id) && !documentos.has(id))
    .map((item) => ({ ...item, origemRobo: true, ativa: true }));
  return [...originaisDisponiveis, ...cadastros];
}
