import type { TamanhoDaTela } from "../usarTamanhoDaTela";

interface DimensoesDaIlha {
  w: number;
  h: number;
  r: number;
}

// A moldura aberta é comum a todas as abas, subseções e detalhes.
export const DIMENSOES_ILHA_EXPANDIDA: Readonly<DimensoesDaIlha> = Object.freeze({ w: 820, h: 500, r: 30 });

export function limitarIlhaATela(dimensoes: DimensoesDaIlha, tela: TamanhoDaTela): DimensoesDaIlha {
  return {
    ...dimensoes,
    w: Math.min(dimensoes.w, Math.max(1, tela.largura - 16)),
    h: Math.min(dimensoes.h, Math.max(1, tela.altura - 24)),
  };
}
