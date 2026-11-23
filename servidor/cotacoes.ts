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
const ENDERECO_REFERENCIA = "https://api.frankfurter.dev/v2/rates?base=BRL&quotes=USD,CNY,EUR";
const PRAZO_FONTE_MS = 4000;
type CambioImportados = {
  taxas: Record<keyof typeof PARES_IMPORTADOS | "BRL", number>;
  atualizadaEm: string;
  fonte: "awesomeapi" | "frankfurter";
};
let cacheImportados: { ate: number; dados: CambioImportados } | undefined;
let pedidoImportados: Promise<CambioImportados> | undefined;

async function buscarCotacaoDeMercado(): Promise<CambioImportados> {
  const resposta = await fetch(ENDERECO_IMPORTADOS, { signal: AbortSignal.timeout(PRAZO_FONTE_MS) });
  if (!resposta.ok) throw new Error(`awesomeapi_http_${resposta.status}`);
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
  return { taxas, atualizadaEm: new Date(Math.min(...instantes)).toISOString(), fonte: "awesomeapi" };
}

async function buscarCotacaoDeReferencia(): Promise<CambioImportados> {
  const resposta = await fetch(ENDERECO_REFERENCIA, { signal: AbortSignal.timeout(PRAZO_FONTE_MS) });
  if (!resposta.ok) throw new Error(`frankfurter_http_${resposta.status}`);
  const dados: unknown = await resposta.json();
  if (!Array.isArray(dados)) throw new Error("frankfurter_resposta_invalida");
  const taxas = { BRL: 1, USD: 0, CNY: 0, EUR: 0 };
  const instantes = [];
  for (const moeda of ["USD", "CNY", "EUR"] as const) {
    const linha = dados.find((item) => item?.base === "BRL" && item.quote === moeda);
    if (typeof linha?.rate !== "number" || !Number.isFinite(linha.rate) || linha.rate <= 0 ||
      typeof linha.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(linha.date)) {
      throw new Error(`frankfurter_cotacao_invalida_${moeda}`);
    }
    const instante = Date.parse(linha.date);
    const taxa = 1 / linha.rate;
    if (!Number.isFinite(instante) || !Number.isFinite(taxa) || taxa >= 1000) {
      throw new Error(`frankfurter_cotacao_invalida_${moeda}`);
    }
    taxas[moeda] = taxa;
    instantes.push(instante);
  }
  return { taxas, atualizadaEm: new Date(Math.min(...instantes)).toISOString(), fonte: "frankfurter" };
}

async function buscarCotacoesImportados(): Promise<CambioImportados> {
  try {
    return await buscarCotacaoDeMercado();
  } catch (erroMercado) {
    console.warn("Falha na cotação de mercado de Importados:", erroMercado);
    return buscarCotacaoDeReferencia();
  }
}

export function lerCotacoesImportados(): Promise<CambioImportados> {
  if (cacheImportados && Date.now() < cacheImportados.ate) return Promise.resolve(cacheImportados.dados);
  pedidoImportados ??= buscarCotacoesImportados().then((dados) => {
    cacheImportados = { ate: Date.now() + 55_000, dados };
    return dados;
  }).finally(() => { pedidoImportados = undefined; });
  return pedidoImportados;
}
