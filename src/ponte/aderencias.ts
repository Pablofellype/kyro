import type { ConfiguracaoAderencias, PlanilhaAderencia, ResultadoAderencia } from "../modulos/escritorio/aderenciasTipos";

export interface PreviaAderencia {
  imagem: string;
  texto: string;
  alertas: number;
  urgentes: number;
}

const CABECALHOS = { "x-niko": "1", "content-type": "application/json" };

async function pedir<T>(caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(`/ponte/aderencias/${caminho}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: CABECALHOS,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const json = await resposta.json().catch(() => ({})) as T & { erro?: string };
  if (!resposta.ok) throw new Error(json.erro ?? `http_${resposta.status}`);
  return json;
}

export const aderenciasPonte = {
  estado: () => pedir<{ disponivel: boolean; navegador: boolean }>("estado"),
  testar: (planilha: PlanilhaAderencia) => pedir<PreviaAderencia>("testar", { planilha }),
  executar: (configuracao: ConfiguracaoAderencias) => pedir<{ resultado: ResultadoAderencia; previas: PreviaAderencia[] }>("executar", { configuracao }),
};
