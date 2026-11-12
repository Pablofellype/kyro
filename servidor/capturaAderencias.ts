export const TELA_DA_CAPTURA = { width: 1600, height: 1000, deviceScaleFactor: 1 } as const;
export const MAXIMO_PIXELS_DA_CAPTURA = 4_000_000;

export interface AreaDaCaptura {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function escalasDaCaptura(area: AreaDaCaptura): number[] {
  if (![area.x, area.y, area.width, area.height].every(Number.isFinite) || area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0) {
    throw new Error("O intervalo da planilha não produziu uma área válida para a captura.");
  }
  const pixels = area.width * area.height;
  if (pixels > MAXIMO_PIXELS_DA_CAPTURA || Math.max(area.width, area.height) > 8192) {
    throw new Error("A área da planilha é grande demais para uma captura. Divida o intervalo em mais de uma planilha.");
  }
  // A resolução extra se aplica somente ao recorte, com orçamento conhecido.
  // Nunca reduzir abaixo de 1x: intervalos excessivos precisam ser divididos.
  const maior = Math.floor(Math.min(2, Math.sqrt(MAXIMO_PIXELS_DA_CAPTURA / pixels), 8192 / Math.max(area.width, area.height)) * 100) / 100;
  return [...new Set([maior, Math.min(1.5, maior), 1])];
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
