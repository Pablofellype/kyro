import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";
import { gerarId, normalizarTexto } from "../utilitarios/basicos";
import { objeto } from "../utilitarios/validacoes";

export const CHAVE_IMPORTADOS = chave("importados");
export const CAMPOS_IMPORTADOS = ["categoria", "plataforma", "fornecedor", "origem"] as const;
export const MOEDAS_IMPORTADOS = ["BRL", "USD", "CNY", "EUR"] as const;
export const MAXIMO_FOTOS_IMPORTADOS = 3;
export type CampoImportado = (typeof CAMPOS_IMPORTADOS)[number];
export type MoedaImportada = (typeof MOEDAS_IMPORTADOS)[number];

export interface ProdutoImportado extends Record<CampoImportado, string> {
  id: string;
  nome: string;
  link: string;
  foto: string;
  fotos: string[];
  preco: number | null;
  moeda: MoedaImportada;
  nota: string;
}

export type DadosProdutoImportado = Omit<ProdutoImportado, "id" | "foto">;
type EntradaProdutoImportado = Omit<DadosProdutoImportado, "fotos"> & { foto?: string; fotos?: string[] };
export interface FornecedorImportado {
  id: string;
  nome: string;
  categoria: string;
  plataforma: string;
  link: string;
}
export type DadosFornecedorImportado = Omit<FornecedorImportado, "id">;
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

export function fotosDeImportado(fotos: unknown): string[] {
  if (!Array.isArray(fotos)) return [];
  return fotos.filter((foto): foto is string =>
    typeof foto === "string" && foto.length <= 300_000 && /^data:image\/jpeg;base64,[a-z0-9+/]+={0,2}$/i.test(foto),
  ).slice(0, MAXIMO_FOTOS_IMPORTADOS);
}

function normalizarProduto(dados: EntradaProdutoImportado): Omit<ProdutoImportado, "id"> | null {
  if (!dados.nome.trim() || (dados.link.trim() && !linkDeImportado(dados.link))) return null;
  if (!MOEDAS_IMPORTADOS.includes(dados.moeda) || (dados.preco !== null && (!Number.isSafeInteger(dados.preco) || dados.preco < 0))) return null;
  const fotos = fotosDeImportado(dados.fotos ?? [dados.foto]);
  return {
    nome: dados.nome.trim().slice(0, 120),
    link: linkDeImportado(dados.link),
    foto: fotos[0] ?? "",
    fotos,
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

function aplicarOpcoes(produto: Record<CampoImportado, string>, opcoes: Map<string, OpcaoImportada>) {
  for (const campo of CAMPOS_IMPORTADOS) {
    if (!produto[campo]) continue;
    const opcao = criarOpcao(campo, produto[campo]);
    const existente = opcoes.get(opcao.id);
    if (existente) produto[campo] = existente.nome;
    else opcoes.set(opcao.id, opcao);
  }
}

function normalizarFornecedor(dados: DadosFornecedorImportado): DadosFornecedorImportado | null {
  const nome = arrumarNome(dados.nome);
  const link = linkDeImportado(dados.link);
  if (!nome || (dados.link.trim() && !link)) return null;
  return { nome, link, categoria: arrumarNome(dados.categoria), plataforma: arrumarNome(dados.plataforma) };
}

function opcoesDoFornecedor(fornecedor: DadosFornecedorImportado, opcoes: Map<string, OpcaoImportada>) {
  const campos = { categoria: fornecedor.categoria, plataforma: fornecedor.plataforma, fornecedor: fornecedor.nome, origem: "" };
  aplicarOpcoes(campos, opcoes);
  return { ...fornecedor, nome: campos.fornecedor, categoria: campos.categoria, plataforma: campos.plataforma };
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
  fornecedores: FornecedorImportado[];
  opcoes: OpcaoImportada[];
  salvarProduto: (dados: EntradaProdutoImportado, id?: string) => boolean;
  salvarFornecedor: (dados: DadosFornecedorImportado, id?: string) => boolean;
  adicionarOpcao: (campo: CampoImportado, nome: string) => boolean;
  excluirProduto: (id: string) => void;
  excluirFornecedor: (id: string) => void;
}

export const useImportados = create<EstadoImportados>()(persist(
  (set, get) => ({
    produtos: [],
    fornecedores: [],
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
    salvarFornecedor(dados, id) {
      const fornecedor = normalizarFornecedor(dados);
      const { produtos, fornecedores, opcoes } = get();
      const anterior = fornecedores.find((atual) => atual.id === id);
      if (!fornecedor || (id && !anterior) || fornecedores.some((atual) =>
        atual.id !== id && normalizarTexto(atual.nome) === normalizarTexto(fornecedor.nome),
      )) return false;
      const nomes = new Map(opcoes.map((opcao) => [opcao.id, opcao]));
      const opcaoAnterior = anterior && criarOpcao("fornecedor", anterior.nome);
      if (opcaoAnterior) nomes.delete(opcaoAnterior.id);
      const salvo = { ...opcoesDoFornecedor(fornecedor, nomes), id: id ?? gerarId() };
      set({
        fornecedores: id ? fornecedores.map((atual) => atual.id === id ? salvo : atual) : [salvo, ...fornecedores],
        produtos: opcaoAnterior ? produtos.map((produto) =>
          criarOpcao("fornecedor", produto.fornecedor).id === opcaoAnterior.id ? { ...produto, fornecedor: salvo.nome } : produto,
        ) : produtos,
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
    excluirFornecedor: (id) => set((s) => ({ fornecedores: s.fornecedores.filter((fornecedor) => fornecedor.id !== id) })),
  }),
  {
    name: CHAVE_IMPORTADOS,
    storage: armazenamento,
    partialize: ({ produtos, opcoes, fornecedores }) => ({ produtos, opcoes, fornecedores }),
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
        if (!["nome", "link", "nota", ...CAMPOS_IMPORTADOS].every((campo) => typeof item[campo] === "string")) continue;
        const produto = normalizarProduto(item as unknown as EntradaProdutoImportado);
        if (!produto) continue;
        aplicarOpcoes(produto, opcoes);
        ids.add(item.id);
        produtos.push({ ...produto, id: item.id });
      }
      const fornecedores: FornecedorImportado[] = [];
      const idsFornecedores = new Set<string>();
      const nomesFornecedores = new Set<string>();
      for (const item of Array.isArray(dados.fornecedores) ? dados.fornecedores : []) {
        if (!objeto(item) || typeof item.id !== "string" || !item.id || idsFornecedores.has(item.id)) continue;
        if (!["nome", "categoria", "plataforma", "link"].every((campo) => typeof item[campo] === "string")) continue;
        const fornecedor = normalizarFornecedor(item as unknown as DadosFornecedorImportado);
        if (!fornecedor) continue;
        const nome = normalizarTexto(fornecedor.nome);
        if (nomesFornecedores.has(nome)) continue;
        nomesFornecedores.add(nome);
        idsFornecedores.add(item.id);
        fornecedores.push({ ...opcoesDoFornecedor(fornecedor, opcoes), id: item.id });
      }
      return { ...atual, produtos, fornecedores, opcoes: [...opcoes.values()] };
    },
  },
));
