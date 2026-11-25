export const TELA_DA_CAPTURA = { width: 1600, height: 1000, deviceScaleFactor: 1 } as const;
export const MAXIMO_PIXELS_DA_CAPTURA = 4_000_000;
export const MAXIMO_PIXELS_DO_PNG_ORIGINAL = 10_000_000;
const LIMITE_DO_LADO = 8192;

export interface AreaDaCaptura {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function escalasDaCaptura(area: AreaDaCaptura, original = false): number[] {
  if (![area.x, area.y, area.width, area.height].every(Number.isFinite) || area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0) {
    throw new Error("O intervalo da planilha não produziu uma área válida para a captura.");
  }
  const pixels = area.width * area.height;
  const ladoMaior = Math.max(area.width, area.height);
  if (pixels > MAXIMO_PIXELS_DA_CAPTURA || ladoMaior > LIMITE_DO_LADO) {
    throw new Error("A área da planilha é grande demais para uma captura. Divida o intervalo em mais de uma planilha.");
  }
  // A resolução extra se aplica somente ao recorte, com orçamento conhecido.
  // Nunca reduzir abaixo de 1x: intervalos excessivos precisam ser divididos.
  const orcamento = original ? MAXIMO_PIXELS_DO_PNG_ORIGINAL : MAXIMO_PIXELS_DA_CAPTURA;
  const maior = Math.floor(Math.min(original ? 3 : 2, Math.sqrt(orcamento / pixels), LIMITE_DO_LADO / ladoMaior) * 100) / 100;
  const intermediarias = original ? [2, 1.5] : [1.5];
  return [maior, ...intermediarias.filter((escala) => escala < maior), ...(maior > 1 ? [1] : [])];
}

export function criarFilaDeCapturas() {
  let anterior = Promise.resolve();
  return async function executar<T>(acao: () => Promise<T>): Promise<T> {
    const esperar = anterior;
    let liberar!: () => void;
    anterior = new Promise<void>((resolver) => { liberar = resolver; });
    await esperar;
    try { return await acao(); }
    finally { liberar(); }
  };
}
