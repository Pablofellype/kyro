import { MOEDAS_IMPORTADOS, fotosDeImportado, type DadosProdutoImportado } from "../../estado/importados";

export interface RascunhoProduto {
  chave: string;
  produtoId: string | null;
  aberto: boolean;
  dados: DadosProdutoImportado;
  preco: string;
}

function chaveDaSessao(usuarioId: number) {
  return `kyro:importados:rascunho:${usuarioId}`;
}

export function lerRascunhoProduto(usuarioId: number): RascunhoProduto | null {
  try {
    const rascunho = JSON.parse(sessionStorage.getItem(chaveDaSessao(usuarioId)) ?? "null") as RascunhoProduto | null;
    const dados = rascunho?.dados;
    if (!rascunho || !dados || typeof rascunho.chave !== "string" || typeof rascunho.preco !== "string" ||
      typeof rascunho.aberto !== "boolean" || (rascunho.produtoId !== null && typeof rascunho.produtoId !== "string") ||
      ![dados.nome, dados.link, dados.categoria, dados.plataforma, dados.fornecedor, dados.origem, dados.nota].every((campo) => typeof campo === "string") ||
      !MOEDAS_IMPORTADOS.includes(dados.moeda)) return null;
    return { ...rascunho, dados: { ...dados, fotos: fotosDeImportado(dados.fotos) } };
  } catch {
    return null;
  }
}

export function guardarRascunhoProduto(usuarioId: number, rascunho: RascunhoProduto | null) {
  try {
    if (rascunho) sessionStorage.setItem(chaveDaSessao(usuarioId), JSON.stringify(rascunho));
    else sessionStorage.removeItem(chaveDaSessao(usuarioId));
  } catch {
    // A aba mantém o rascunho em memória se o navegador bloquear a sessão.
  }
}
