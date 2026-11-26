import { randomUUID } from "node:crypto";
import { consultarInventario, lerFotoDoInventario, lerReservasInventario, retomarConsultaInventario, type SolicitacaoMaterialRecebida } from "../src/servicos/inventarioIntegracao.ts";

export function criarInventarioLocal(endereco: string | undefined) {
  if (!endereco) return undefined;
  const origem = new URL(endereco);
  if (origem.protocol !== "http:" || origem.hostname !== "127.0.0.1" || !origem.port || origem.username || origem.password
    || origem.pathname !== "/api/integracoes/solicitacoes" || origem.search || origem.hash) {
    throw new Error("INVENTARIO_INTEGRACAO_URL_LOCAL deve apontar para a integração em 127.0.0.1.");
  }
  const consultar: typeof fetch = (url, opcoes) => {
    const destino = new URL(origem);
    destino.search = new URL(String(url)).search;
    return fetch(destino, opcoes);
  };

  type Assinatura = { cursor: string; assinatura: string; total: number; recentes: SolicitacaoMaterialRecebida[] };
  const assinaturas = new Map<number, Assinatura>();
  const consultas = new Map<number, Promise<Assinatura | null>>();
  const desativadas = new Set<number>();

  async function atualizar(id: number): Promise<Assinatura> {
    const anterior = assinaturas.get(id);
    if (!anterior) {
      const { cursor } = await consultarInventario(undefined, consultar);
      return { cursor, assinatura: randomUUID(), total: 0, recentes: [] };
    }
    const pagina = await retomarConsultaInventario(anterior.cursor, consultar);
    const base = pagina.reiniciado ? { assinatura: randomUUID(), total: 0, recentes: [] } : anterior;
    const novos = pagina.solicitacoes.map((pedido, i) => ({ ...pedido, ordem: base.total + i + 1 }));
    return { cursor: pagina.cursor, assinatura: base.assinatura, total: base.total + novos.length,
      recentes: [...novos.reverse(), ...base.recentes].slice(0, 20) };
  }

  return {
    historico: () => lerReservasInventario(consultar),
    foto: (evento: unknown, protocolo?: unknown) => lerFotoDoInventario(evento, consultar, protocolo),
    notificacao: (id: number) => assinaturas.get(id) ?? null,
    ativa: (id: number) => !desativadas.has(id),
    alterarPreferencia(id: number, ativa: boolean) {
      if (ativa) desativadas.delete(id);
      else { desativadas.add(id); assinaturas.delete(id); consultas.delete(id); }
    },
    async acompanhar(id: number) {
      if (desativadas.has(id)) return null;
      const existente = consultas.get(id);
      if (existente) return existente;
      const consulta = atualizar(id).then((estado) => {
        if (consultas.get(id) !== consulta) return null;
        assinaturas.set(id, estado);
        return estado;
      }).finally(() => {
        if (consultas.get(id) === consulta) consultas.delete(id);
      });
      consultas.set(id, consulta);
      return consulta;
    },
  };
}
