const ENDERECO = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL";
const VALIDADE_MS = 30 * 60_000;

let guardada: { quando: number; dados: { USD: number; EUR: number; atualizadaEm: string } } | null = null;

function numero(valor: unknown): number {
  const n = typeof valor === "string" ? Number(valor) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : 0;
}

export async function lerCotacoes() {
  if (guardada && Date.now() - guardada.quando < VALIDADE_MS) return guardada.dados;
  const r = await fetch(ENDERECO, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`cotacao_http_${r.status}`);
  const json = (await r.json()) as Record<string, { bid?: unknown; timestamp?: unknown }>;
  const dados = { USD: numero(json.USDBRL?.bid), EUR: numero(json.EURBRL?.bid), atualizadaEm: new Date().toISOString() };
  if (!dados.USD || !dados.EUR) throw new Error("cotacao_invalida");
  guardada = { quando: Date.now(), dados };
  return dados;
}

const PARES_IMPORTADOS = { USD: "USDBRL", CNY: "CNYBRL", EUR: "EURBRL" } as const;
const ENDERECO_IMPORTADOS = "https://economia.awesomeapi.com.br/json/last/USD-BRL,CNY-BRL,EUR-BRL";
type CambioImportados = { taxas: Record<keyof typeof PARES_IMPORTADOS | "BRL", number>; atualizadaEm: string };
let cacheImportados: { ate: number; dados: CambioImportados } | undefined;
let pedidoImportados: Promise<CambioImportados> | undefined;

async function buscarCotacoesImportados(): Promise<CambioImportados> {
  const resposta = await fetch(ENDERECO_IMPORTADOS, { signal: AbortSignal.timeout(10_000) });
  if (!resposta.ok) throw new Error(`cotacao_http_${resposta.status}`);
  const dados = (await resposta.json()) as Record<string, { bid?: unknown; timestamp?: unknown }>;
  const taxas = {
    BRL: 1,
    USD: numero(dados[PARES_IMPORTADOS.USD]?.bid),
    CNY: numero(dados[PARES_IMPORTADOS.CNY]?.bid),
    EUR: numero(dados[PARES_IMPORTADOS.EUR]?.bid),
  };
  const instantes = Object.values(PARES_IMPORTADOS).map((par) => Number(dados[par]?.timestamp) * 1000);
  if (Object.values(taxas).some((taxa) => !taxa) || instantes.some((em) => !Number.isFinite(em) || em <= 0 || em > 8.64e15)) {
    throw new Error("cotacao_invalida");
  }
  const cambio = { taxas, atualizadaEm: new Date(Math.min(...instantes)).toISOString() };
  cacheImportados = { ate: Date.now() + 55_000, dados: cambio };
  return cambio;
}

export function lerCotacoesImportados(): Promise<CambioImportados> {
  if (cacheImportados && Date.now() < cacheImportados.ate) return Promise.resolve(cacheImportados.dados);
  pedidoImportados ??= buscarCotacoesImportados().finally(() => { pedidoImportados = undefined; });
  return pedidoImportados;
}
