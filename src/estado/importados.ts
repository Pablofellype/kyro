import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";
import { gerarId, normalizarTexto } from "../utilitarios/basicos";
import { objeto } from "../utilitarios/validacoes";

export const CHAVE_IMPORTADOS = chave("importados");
export const CAMPOS_IMPORTADOS = ["categoria", "plataforma", "fornecedor", "origem"] as const;
export const MOEDAS_IMPORTADOS = ["BRL", "USD", "CNY", "EUR"] as const;
export type CampoImportado = (typeof CAMPOS_IMPORTADOS)[number];
export type MoedaImportada = (typeof MOEDAS_IMPORTADOS)[number];

export interface ProdutoImportado extends Record<CampoImportado, string> {
  id: string;
  nome: string;
  link: string;
  foto: string;
  preco: number | null;
  moeda: MoedaImportada;
  nota: string;
}

export type DadosProdutoImportado = Omit<ProdutoImportado, "id">;
export type OpcoesImportados = Record<CampoImportado, string[]>;
export type FiltrosImportados = Record<CampoImportado, string> & {
  busca: string;
  moeda: MoedaImportada | "";
  minimo: number | null;
  maximo: number | null;
};

interface OpcaoImportada {
  id: string;
  campo: CampoImportado;
  nome: string;
}

const arrumarNome = (nome: string) => nome.trim().replace(/\s+/g, " ").slice(0, 80);

export function linkDeImportado(texto: string): string {
  if (!texto.trim() || texto.length > 2048) return "";
  try {
    const url = new URL(texto.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

function normalizarProduto(dados: DadosProdutoImportado): DadosProdutoImportado | null {
  if (!dados.nome.trim() || (dados.link.trim() && !linkDeImportado(dados.link))) return null;
  if (!MOEDAS_IMPORTADOS.includes(dados.moeda) || (dados.preco !== null && (!Number.isSafeInteger(dados.preco) || dados.preco < 0))) return null;
  return {
    nome: dados.nome.trim().slice(0, 120),
    link: linkDeImportado(dados.link),
    foto: dados.foto.length <= 300_000 && /^data:image\/jpeg;base64,[a-z0-9+/]+={0,2}$/i.test(dados.foto) ? dados.foto : "",
    preco: dados.preco,
    moeda: dados.moeda,
    categoria: arrumarNome(dados.categoria),
    plataforma: arrumarNome(dados.plataforma),
    fornecedor: arrumarNome(dados.fornecedor),
    origem: arrumarNome(dados.origem),
    nota: dados.nota.trim().slice(0, 600),
  };
}

function criarOpcao(campo: CampoImportado, nome: string): OpcaoImportada {
  const limpo = arrumarNome(nome);
  return { id: `${campo}:${normalizarTexto(limpo)}`, campo, nome: limpo };
}

function aplicarOpcoes(produto: DadosProdutoImportado, opcoes: Map<string, OpcaoImportada>) {
  for (const campo of CAMPOS_IMPORTADOS) {
    if (!produto[campo]) continue;
    const opcao = criarOpcao(campo, produto[campo]);
    const existente = opcoes.get(opcao.id);
    if (existente) produto[campo] = existente.nome;
    else opcoes.set(opcao.id, opcao);
  }
}

export function listarOpcoesImportados(opcoes: readonly OpcaoImportada[]): OpcoesImportados {
  const resultado: OpcoesImportados = { categoria: [], plataforma: [], fornecedor: [], origem: [] };
  for (const { campo, nome } of opcoes) resultado[campo].push(nome);
  for (const campo of CAMPOS_IMPORTADOS) resultado[campo].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return resultado;
}

export function filtrarImportados(produtos: readonly ProdutoImportado[], filtros: FiltrosImportados): ProdutoImportado[] {
  const termos = normalizarTexto(filtros.busca).split(/\s+/).filter(Boolean);
  return produtos.filter((produto) => {
    if (filtros.moeda && produto.moeda !== filtros.moeda) return false;
    if (filtros.minimo !== null && (produto.preco === null || produto.preco < filtros.minimo)) return false;
    if (filtros.maximo !== null && (produto.preco === null || produto.preco > filtros.maximo)) return false;
    if (!CAMPOS_IMPORTADOS.every((campo) => !filtros[campo] || normalizarTexto(produto[campo]) === normalizarTexto(filtros[campo]))) return false;
    const texto = normalizarTexto([produto.nome, produto.link, produto.nota, ...CAMPOS_IMPORTADOS.map((campo) => produto[campo])].join(" "));
    return termos.every((termo) => texto.includes(termo));
  });
}

interface EstadoImportados {
  produtos: ProdutoImportado[];
  opcoes: OpcaoImportada[];
  salvarProduto: (dados: DadosProdutoImportado, id?: string) => boolean;
  adicionarOpcao: (campo: CampoImportado, nome: string) => boolean;
  excluirProduto: (id: string) => void;
}

export const useImportados = create<EstadoImportados>()(persist(
  (set, get) => ({
    produtos: [],
    opcoes: [],
    salvarProduto(dados, id) {
      const produto = normalizarProduto(dados);
      const { produtos, opcoes } = get();
      if (!produto || (id && !produtos.some((atual) => atual.id === id))) return false;
      const nomes = new Map(opcoes.map((opcao) => [opcao.id, opcao]));
      aplicarOpcoes(produto, nomes);
      const salvo = { ...produto, id: id ?? gerarId() };
      set({
        produtos: id ? produtos.map((atual) => atual.id === id ? salvo : atual) : [salvo, ...produtos],
        opcoes: [...nomes.values()],
      });
      return true;
    },
    adicionarOpcao(campo, nome) {
      const opcao = criarOpcao(campo, nome);
      const { opcoes } = get();
      if (!opcao.nome || opcoes.some((atual) => atual.id === opcao.id)) return false;
      set({ opcoes: [...opcoes, opcao] });
      return true;
    },
    excluirProduto: (id) => set((s) => ({ produtos: s.produtos.filter((produto) => produto.id !== id) })),
  }),
  {
    name: CHAVE_IMPORTADOS,
    storage: armazenamento,
    partialize: ({ produtos, opcoes }) => ({ produtos, opcoes }),
    merge: (persistido, atual) => {
      const dados = objeto(persistido) ? persistido : {};
      const opcoes = new Map<string, OpcaoImportada>();
      for (const opcao of Array.isArray(dados.opcoes) ? dados.opcoes : []) {
        if (!objeto(opcao) || !CAMPOS_IMPORTADOS.includes(opcao.campo as CampoImportado) || typeof opcao.nome !== "string") continue;
        const salva = criarOpcao(opcao.campo as CampoImportado, opcao.nome);
        if (salva.nome) opcoes.set(salva.id, salva);
      }
      const produtos: ProdutoImportado[] = [];
      const ids = new Set<string>();
      for (const item of Array.isArray(dados.produtos) ? dados.produtos : []) {
        if (!objeto(item) || typeof item.id !== "string" || !item.id || ids.has(item.id)) continue;
        if (!["nome", "link", "foto", "nota", ...CAMPOS_IMPORTADOS].every((campo) => typeof item[campo] === "string")) continue;
        const produto = normalizarProduto(item as unknown as DadosProdutoImportado);
        if (!produto) continue;
        aplicarOpcoes(produto, opcoes);
        ids.add(item.id);
        produtos.push({ ...produto, id: item.id });
      }
      return { ...atual, produtos, opcoes: [...opcoes.values()] };
    },
  },
));
