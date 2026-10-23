import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";
import { gerarId } from "../utilitarios/basicos";

export interface VariacaoMaterial {
  tamanho: string;
  codigo: string;
}

export interface MaterialItem {
  id: string;
  nome: string;
  variacoes: VariacaoMaterial[];
}

export function interpretarVariacoes(texto: string): VariacaoMaterial[] {
  const limpo = texto.trim();
  if (!limpo) return [];
  const partes = limpo
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  const resultado: VariacaoMaterial[] = [];
  for (const parte of partes) {
    const separador = parte.match(/^(.+?)\s*[:\-–]\s*([A-Za-z0-9._-]+)$/);
    if (separador) {
      resultado.push({
        tamanho: separador[1].trim(),
        codigo: separador[2].trim(),
      });
    } else {
      resultado.push({
        tamanho: "",
        codigo: parte.trim(),
      });
    }
  }
  return resultado;
}

export function formatarVariacoes(variacoes: VariacaoMaterial[]): string {
  return variacoes
    .map((v) => (v.tamanho ? `${v.tamanho}:${v.codigo}` : v.codigo))
    .join(" | ");
}

export function importarBlocoDeTexto(bloco: string): Omit<MaterialItem, "id">[] {
  const linhas = bloco
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const itens: Omit<MaterialItem, "id">[] = [];
  let i = 0;
  while (i < linhas.length) {
    const atual = linhas[i];
    const proxima = linhas[i + 1];
    const atualPareceCodigo =
      atual.includes("|") ||
      /^(n[º°o]?\s*\d+|\d{4,})/i.test(atual) ||
      /^.+?\s*[:\-]\s*\d{4,}$/.test(atual);

    if (!atualPareceCodigo && proxima) {
      const variacoes = interpretarVariacoes(proxima);
      if (variacoes.length > 0) {
        itens.push({ nome: atual.toUpperCase(), variacoes });
        i += 2;
        continue;
      }
    }
    const naMesmaLinha = atual.match(/^([A-Za-zÀ-ÿ\s]+?)\s*[-–:]\s*(.+)$/);
    if (naMesmaLinha && !atual.includes("|")) {
      const variacoes = interpretarVariacoes(naMesmaLinha[2]);
      if (variacoes.length > 0) {
        itens.push({ nome: naMesmaLinha[1].trim().toUpperCase(), variacoes });
        i += 1;
        continue;
      }
    }
    i += 1;
  }
  return itens;
}

export const MATERIAIS_INICIAIS: MaterialItem[] = [
  {
    id: "mat-bota-preta",
    nome: "BOTA PRETA",
    variacoes: interpretarVariacoes(
      "Nº 33:7003123 |Nº 34:7003124 |Nº 35:7003125 |Nº 36:7003126 |Nº 37:7003127 |Nº 38:7003128 |Nº 39:7003129 |Nº 40:7003130 |Nº 41:7003132 |Nº 42:7003133 |Nº 43:7003134 |Nº 44:7003136 |Nº 45:7003137 |Nº 46:7003138 |Nº 47:7003139",
    ),
  },
  {
    id: "mat-oculos-policarbonato",
    nome: "ÓCULOS POLICARBONATO",
    variacoes: [{ tamanho: "", codigo: "7000427" }],
  },
];

interface EstadoMateriais {
  materiais: MaterialItem[];
  adicionarMaterial: (nome: string, textoCodigos: string) => void;
  atualizarMaterial: (id: string, nome: string, textoCodigos: string) => void;
  importarTexto: (bloco: string) => number;
  excluirMaterial: (id: string) => void;
}

export const useMateriais = create<EstadoMateriais>()(
  persist(
    (set, get) => ({
      materiais: MATERIAIS_INICIAIS,
      adicionarMaterial: (nome, textoCodigos) => {
        const nomeLimpo = nome.trim().toUpperCase();
        const variacoes = interpretarVariacoes(textoCodigos);
        if (!nomeLimpo || variacoes.length === 0) return;
        set((s) => ({
          materiais: [
            ...s.materiais,
            { id: gerarId(), nome: nomeLimpo, variacoes },
          ],
        }));
      },
      atualizarMaterial: (id, nome, textoCodigos) => {
        const nomeLimpo = nome.trim().toUpperCase();
        const variacoes = interpretarVariacoes(textoCodigos);
        if (!nomeLimpo || variacoes.length === 0) return;
        set((s) => ({
          materiais: s.materiais.map((m) =>
            m.id === id ? { ...m, nome: nomeLimpo, variacoes } : m,
          ),
        }));
      },
      importarTexto: (bloco) => {
        const novos = importarBlocoDeTexto(bloco);
        if (novos.length === 0) return 0;
        const atuais = [...get().materiais];
        for (const item of novos) {
          const indice = atuais.findIndex(
            (m) => m.nome.toUpperCase() === item.nome.toUpperCase(),
          );
          if (indice >= 0) {
            atuais[indice] = { ...atuais[indice], variacoes: item.variacoes };
          } else {
            atuais.push({ id: gerarId(), ...item });
          }
        }
        set({ materiais: atuais });
        return novos.length;
      },
      excluirMaterial: (id) =>
        set((s) => ({ materiais: s.materiais.filter((m) => m.id !== id) })),
    }),
    { name: chave("materiais"), storage: armazenamento },
  ),
);
