export class InventarioIndisponivel extends Error {
  constructor(codigo = "inventario_indisponivel") {
    super(codigo);
  }
}

const URL_INVENTARIO = "https://inventario-internoo.vercel.app/api/integracoes/solicitacoes";

export interface ResumoSolicitacaoMaterial {
  chave?: string;
  protocolo: string;
  solicitante: string;
  tipo: string;
  itens: string;
  local: string;
  data: string;
}

export type SolicitacaoMaterialRecebida = ResumoSolicitacaoMaterial & { ordem: number };

function texto(valor: unknown, limite: number): string {
  return typeof valor === "string" ? valor.trim().replace(/\s+/g, " ").slice(0, limite) : "";
}

export function chaveDaSolicitacaoMaterial(pedido: ResumoSolicitacaoMaterial): string {
  return pedido.chave || (pedido.protocolo ? `protocolo:${pedido.protocolo.toUpperCase()}` : "");
}

export function unirSolicitacoesMaterial(anterior: ResumoSolicitacaoMaterial, atual: ResumoSolicitacaoMaterial): ResumoSolicitacaoMaterial {
  const itens = [...new Set([anterior.itens, atual.itens].flatMap((lista) => lista.split(" · ")).filter(Boolean))].join(" · ");
  return {
    chave: chaveDaSolicitacaoMaterial(anterior) || chaveDaSolicitacaoMaterial(atual),
    protocolo: anterior.protocolo || atual.protocolo,
    solicitante: anterior.solicitante || atual.solicitante,
    tipo: anterior.tipo || atual.tipo,
    itens: itens.slice(0, 500),
    local: anterior.local || atual.local,
    data: anterior.data || atual.data,
  };
}

export async function consultarInventario(cursor?: string, consultar: typeof fetch = fetch, signal?: AbortSignal) {
  const token = process.env.INVENTARIO_INTEGRACAO_TOKEN?.trim();
  if (!token) throw new InventarioIndisponivel("inventario_token_ausente");
  const url = new URL(URL_INVENTARIO);
  if (cursor !== undefined) url.searchParams.set("cursor", cursor);

  try {
    const resposta = await consultar(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      redirect: "error",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
    });
    if (resposta.status === 401 || resposta.status === 403) throw new InventarioIndisponivel("inventario_token_rejeitado");
    if (!resposta.ok) throw new InventarioIndisponivel();
    const corpo = await resposta.json().catch(() => null);
    const proximo = corpo?.proximo_cursor;
    const cursorValido = (typeof proximo === "string" && proximo.trim().length > 0 && proximo.length <= 512)
      || (typeof proximo === "number" && Number.isSafeInteger(proximo) && proximo >= 0);
    if (!cursorValido) throw new InventarioIndisponivel("inventario_resposta_invalida");
    if (cursor === undefined) return { cursor: String(proximo), quantidade: 0, solicitacoes: [], temMais: false };
    const eventos = corpo.eventos;
    const temMais = corpo.tem_mais === true;
    if (!Array.isArray(eventos) || ((eventos.length || temMais) && String(proximo) === cursor)) {
      throw new InventarioIndisponivel("inventario_resposta_invalida");
    }
    const agrupadas = new Map<string, ResumoSolicitacaoMaterial>();
    for (const evento of eventos) {
      if (evento?.tipo !== "solicitacao.recebida") continue;
      const { solicitacao } = evento;
      const protocolo = texto(solicitacao?.protocolo, 80);
      const idEvento = texto(typeof evento.id === "number" ? String(evento.id) : evento.id, 200);
      if (!protocolo && !idEvento) throw new InventarioIndisponivel("inventario_resposta_invalida");
      const chave = protocolo ? `protocolo:${protocolo.toUpperCase()}` : `evento:${idEvento}`;
      const pedido = {
        chave,
        protocolo,
        solicitante: texto(solicitacao?.solicitante, 120),
        tipo: texto(solicitacao?.tipo, 80),
        itens: texto(solicitacao?.itens, 500),
        local: texto(solicitacao?.local, 120),
        data: texto(solicitacao?.data_solicitacao, 64),
      };
      const anterior = agrupadas.get(chave);
      agrupadas.set(chave, anterior ? unirSolicitacoesMaterial(anterior, pedido) : pedido);
    }
    const solicitacoes = [...agrupadas.values()];
    return { cursor: String(proximo), quantidade: solicitacoes.length, solicitacoes, temMais };
  } catch (erro) {
    if (erro instanceof InventarioIndisponivel) throw erro;
    throw new InventarioIndisponivel();
  }
}

export async function retomarConsultaInventario(cursor: string, consultar: typeof fetch = fetch) {
  const signal = AbortSignal.timeout(13_000);
  const pagina = await consultarInventario(cursor, consultar, signal);
  if (pagina.cursor !== cursor || !/^[1-9]\d{0,18}$/.test(cursor)) return { ...pagina, reiniciado: false };

  // Uma página vazia repete o cursor de entrada mesmo quando a sequência do inventário voltou ao início.
  const atual = await consultarInventario(undefined, consultar, signal);
  if (!/^\d{1,19}$/.test(atual.cursor) || BigInt(atual.cursor) >= BigInt(cursor)) return { ...pagina, reiniciado: false };
  const primeira = atual.cursor === "0" ? atual : await consultarInventario("0", consultar, signal);
  return { ...primeira, reiniciado: true };
}

export async function lerHistoricoInventario(consultar: typeof fetch = fetch) {
  const signal = AbortSignal.timeout(13_000);
  let cursor = "0";
  let parcial = false;
  const pedidos = new Map<string, ResumoSolicitacaoMaterial>();
  for (let pagina = 0; pagina < 4; pagina++) {
    const resultado = await consultarInventario(cursor, consultar, signal);
    for (const pedido of resultado.solicitacoes) {
      const chave = chaveDaSolicitacaoMaterial(pedido);
      const anterior = pedidos.get(chave);
      pedidos.set(chave, anterior ? unirSolicitacoesMaterial(anterior, pedido) : pedido);
    }
    cursor = resultado.cursor;
    parcial = resultado.temMais;
    if (!parcial) break;
  }
  return { pedidos: [...pedidos.values()].slice(-20).reverse(), parcial };
}
