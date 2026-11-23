import { useEffect, useState } from "react";
import { NATIVO } from "../../desktop/desktop";
import { urlApi } from "../../estado/autenticacao";
import { MOEDAS_IMPORTADOS, type MoedaImportada } from "../../estado/importados";

export interface CambioImportados {
  taxas: Record<MoedaImportada, number>;
  atualizadaEm: string;
  fonte?: "awesomeapi" | "frankfurter";
}

const INTERVALO_MS = 60_000;
const VALIDADE_MS = 55_000;
let ultimo: { dados: CambioImportados; recebidoEm: number } | undefined;
let pedido: Promise<CambioImportados> | undefined;

function buscarCambio(): Promise<CambioImportados> {
  if (ultimo && Date.now() - ultimo.recebidoEm < VALIDADE_MS) return Promise.resolve(ultimo.dados);
  const destino = NATIVO || import.meta.env.DEV ? "/ponte/cotacoes?escopo=importados" : urlApi("/api/cotacoes");
  pedido ??= fetch(destino, { headers: { "x-niko": "1" }, signal: AbortSignal.timeout(12_000) }).then(async (r) => {
    if (!r.ok) throw new Error("cotacao_indisponivel");
    const dados = await r.json() as CambioImportados;
    if (!dados?.taxas || !Number.isFinite(Date.parse(dados.atualizadaEm)) ||
      !MOEDAS_IMPORTADOS.every((moeda) => Number.isFinite(dados.taxas[moeda]) && dados.taxas[moeda] > 0)) {
      throw new Error("cotacao_invalida");
    }
    ultimo = { dados, recebidoEm: Date.now() };
    return dados;
  }).finally(() => { pedido = undefined; });
  return pedido;
}

export function converterPrecoImportado(valor: number, origem: MoedaImportada, destino: MoedaImportada, cambio?: CambioImportados): number | null {
  if (origem === destino) return valor;
  if (!cambio) return null;
  const convertido = Math.round(valor * (cambio.taxas[origem] / cambio.taxas[destino]));
  return Number.isSafeInteger(convertido) ? convertido : null;
}

export function usarCambioImportados(ativo: boolean) {
  const [cambio, setCambio] = useState(ultimo?.dados);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    let ativoNaTela = true;
    const atualizar = () => {
      if (document.hidden) return;
      void buscarCambio().then((dados) => {
        if (!ativoNaTela) return;
        setCambio(dados);
        setFalhou(false);
      }).catch(() => { if (ativoNaTela) setFalhou(true); });
    };
    atualizar();
    const intervalo = window.setInterval(atualizar, INTERVALO_MS);
    document.addEventListener("visibilitychange", atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      ativoNaTela = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", atualizar);
      window.removeEventListener("focus", atualizar);
    };
  }, [ativo]);
  return { cambio, falhou };
}
