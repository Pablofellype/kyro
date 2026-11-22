import { randomUUID } from "node:crypto";
import { getDb, validarSessao } from "./autenticacao.ts";
import { chaveDaSolicitacaoMaterial, consultarInventario, InventarioIndisponivel, lerHistoricoInventario, unirSolicitacoesMaterial, type SolicitacaoMaterialRecebida } from "./inventarioIntegracao.ts";
import { APLICATIVOS_EMPRESA, type AplicativoEmpresa } from "../modulos/escritorio/aplicativosEmpresaConfig.ts";

let tabelasProntas: Promise<unknown> | undefined;

function garantirTabelas() {
  if (tabelasProntas) return tabelasProntas;
  const sql = getDb();
  tabelasProntas = sql.transaction([
    sql`SELECT pg_advisory_xact_lock(192371605, 1)`,
    sql`CREATE TABLE IF NOT EXISTS aplicativos_empresa (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL, url TEXT,
      status TEXT NOT NULL CHECK (status IN ('disponivel', 'manutencao')), publico BOOLEAN NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    sql`CREATE TABLE IF NOT EXISTS notificacoes_apps_empresa (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fonte TEXT NOT NULL, cursor TEXT NOT NULL, assinatura UUID NOT NULL,
      total BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (usuario_id, fonte)
    )`,
    sql`ALTER TABLE notificacoes_apps_empresa ADD COLUMN IF NOT EXISTS recentes JSONB NOT NULL DEFAULT '[]'::jsonb`,
    sql`ALTER TABLE notificacoes_apps_empresa ADD COLUMN IF NOT EXISTS contagem JSONB`,
  ]).catch((erro) => {
    tabelasProntas = undefined;
    throw erro;
  });
  return tabelasProntas;
}

async function listarAplicativos(interno: boolean) {
  const sql = getDb();
  const gravados = await sql`SELECT id, nome, descricao, url, status, publico FROM aplicativos_empresa ORDER BY criado_em, id` as AplicativoEmpresa[];
  const catalogo = new Map(APLICATIVOS_EMPRESA.map((app) => [app.id, app]));
  for (const app of gravados) catalogo.set(app.id, app);
  return [...catalogo.values()].filter((app) => interno || app.publico);
}

function validarAplicativo(corpo: Record<string, unknown>):
  (Omit<AplicativoEmpresa, "id"> & { id: string | null; criacaoId?: string }) | null {
  const id = corpo.id ?? null;
  if (id !== null && (typeof id !== "string" || !/^[a-z0-9-]{1,64}$/.test(id))) return null;
  const criacaoId = corpo.criacaoId;
  if (id === null && (typeof criacaoId !== "string" || !/^[a-z0-9-]{8,60}$/.test(criacaoId))) return null;
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const descricao = typeof corpo.descricao === "string" ? corpo.descricao.trim() : "";
  const status = corpo.status;
  if (!nome || nome.length > 80 || descricao.length > 240 || typeof corpo.publico !== "boolean") return null;
  if (status !== "disponivel" && status !== "manutencao") return null;
  const endereco = typeof corpo.url === "string" ? corpo.url.trim() : "";
  let url: URL | null = null;
  if (endereco) {
    try {
      url = new URL(endereco);
      if (!/^https?:\/\//i.test(endereco) || url.username || url.password || url.href.length > 2048) return null;
    } catch {
      return null;
    }
  }
  if (status === "disponivel" && !url) return null;
  return { id, criacaoId: typeof criacaoId === "string" ? criacaoId : undefined, nome, descricao, url: url?.href ?? null, status, publico: corpo.publico };
}

async function salvarAplicativo(app: NonNullable<ReturnType<typeof validarAplicativo>>) {
  const sql = getDb();
  const id = app.id ?? `app-${app.criacaoId}`;
  if (!app.id) {
    await sql`
      INSERT INTO aplicativos_empresa (id, nome, descricao, url, status, publico)
      VALUES (${id}, ${app.nome}, ${app.descricao}, ${app.url}, ${app.status}, ${app.publico})
      ON CONFLICT (id) DO NOTHING
    `;
    return true;
  }
  if (!APLICATIVOS_EMPRESA.some((padrao) => padrao.id === id)) {
    const existentes = await sql`SELECT id FROM aplicativos_empresa WHERE id = ${id}`;
    if (!existentes.length) return false;
  }
  await sql`
    INSERT INTO aplicativos_empresa (id, nome, descricao, url, status, publico)
    VALUES (${id}, ${app.nome}, ${app.descricao}, ${app.url}, ${app.status}, ${app.publico})
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,
      url = EXCLUDED.url, status = EXCLUDED.status, publico = EXCLUDED.publico
  `;
  return true;
}

const FONTES = {
  inventario: { consultar: consultarInventario },
};
type Fonte = keyof typeof FONTES;

interface AssinaturaInventario {
  cursor: string;
  assinatura: string;
  total: string;
  recentes: SolicitacaoMaterialRecebida[];
  contagem: { chaves: string[]; corrigidas: number; ordensCorrigidas: number[] } | null;
}

async function lerAssinatura(usuarioId: number, fonte: Fonte) {
  const sql = getDb();
  const [linha] = await sql`
    SELECT cursor, assinatura, total, recentes, contagem FROM notificacoes_apps_empresa
    WHERE usuario_id = ${usuarioId} AND fonte = ${fonte}
  `;
  return linha as AssinaturaInventario | undefined;
}

function dadosDaAssinatura(atual: AssinaturaInventario | undefined) {
  return atual ? {
    assinatura: atual.assinatura,
    total: Number(atual.total),
    recentes: atual.recentes,
    corrigidas: atual.contagem?.corrigidas ?? 0,
    ...(atual.contagem?.ordensCorrigidas?.length ? { ordensCorrigidas: atual.contagem.ordensCorrigidas } : {}),
  } : null;
}

async function alterarPreferencia(usuarioId: number, fonte: Fonte, ativa: boolean) {
  const sql = getDb();
  if (!ativa) {
    await sql`DELETE FROM notificacoes_apps_empresa WHERE usuario_id = ${usuarioId} AND fonte = ${fonte}`;
  } else if (!(await lerAssinatura(usuarioId, fonte))) {
    const { cursor } = await FONTES[fonte].consultar();
    await sql`
      INSERT INTO notificacoes_apps_empresa (usuario_id, fonte, cursor, assinatura)
      VALUES (${usuarioId}, ${fonte}, ${cursor}, ${randomUUID()})
      ON CONFLICT (usuario_id, fonte) DO NOTHING
    `;
  }
}

async function acompanharNotificacoes(usuarioId: number, fonte: Fonte) {
  const anterior = await lerAssinatura(usuarioId, fonte);
  if (!anterior) return null;
  const { cursor, solicitacoes } = await FONTES[fonte].consultar(anterior.cursor);
  const sql = getDb();
  if (cursor !== anterior.cursor || !anterior.contagem) {
    // Somente uma consulta pode contabilizar a mesma página de eventos.
    const chaves = new Set(anterior.contagem?.chaves);
    const recentes = new Map<string, SolicitacaoMaterialRecebida>();
    const totalAnterior = Number(anterior.total);
    let total = totalAnterior;
    let corrigidas = anterior.contagem?.corrigidas ?? 0;
    const ordensCorrigidas = [...(anterior.contagem?.ordensCorrigidas ?? [])];
    // As assinaturas antigas preservam o total dos pedidos que já saíram da lista de recentes.
    if (!anterior.contagem) total -= anterior.recentes.length;
    for (const pedido of [...anterior.recentes].reverse()) {
      const chave = chaveDaSolicitacaoMaterial(pedido) || `anterior:${pedido.ordem}`;
      const salvo = recentes.get(chave);
      if (salvo) {
        recentes.set(chave, { ...unirSolicitacoesMaterial(salvo, pedido), ordem: salvo.ordem });
        if (!anterior.contagem) ordensCorrigidas.push(pedido.ordem);
      }
      else recentes.set(chave, { ...pedido, ordem: anterior.contagem ? pedido.ordem : ++total });
      chaves.add(chave);
    }
    if (!anterior.contagem) corrigidas += totalAnterior - total;
    for (const pedido of solicitacoes) {
      const chave = chaveDaSolicitacaoMaterial(pedido);
      const salvo = recentes.get(chave);
      if (salvo) recentes.set(chave, { ...unirSolicitacoesMaterial(salvo, pedido), ordem: salvo.ordem });
      else if (!chaves.has(chave)) recentes.set(chave, { ...pedido, ordem: ++total });
      chaves.add(chave);
    }
    const ultimas = [...recentes.values()].slice(-20).reverse();
    const contagem = { chaves: [...chaves], corrigidas, ordensCorrigidas };
    await sql`
      UPDATE notificacoes_apps_empresa
      SET cursor = ${cursor}, total = ${total}, recentes = ${JSON.stringify(ultimas)}::jsonb, contagem = ${JSON.stringify(contagem)}::jsonb
      WHERE usuario_id = ${usuarioId} AND fonte = ${fonte}
        AND assinatura = ${anterior.assinatura} AND cursor = ${anterior.cursor}
    `;
  }
  return dadosDaAssinatura(await lerAssinatura(usuarioId, fonte));
}

type Resposta = { status: number; dados: unknown };

export async function tratarAplicativosEmpresa(
  metodo: string | undefined, acao: string | null, token: string, lerCorpo: () => Promise<Record<string, unknown>>,
): Promise<Resposta> {
  const responder = (status: number, dados: unknown): Resposta => ({ status, dados });
  if (metodo !== "GET" && metodo !== "POST") return responder(405, { erro: "metodo_nao_permitido" });
  try {
    const usuario = token ? await validarSessao(token) : null;
    if (token && !usuario) return responder(401, { erro: "nao_autenticado" });
    const interno = usuario?.perfil === "dono" || usuario?.perfil === "gerencia";
    if (!acao || acao === "catalogo") {
      if (metodo === "POST" && usuario?.perfil !== "dono") return responder(403, { erro: "permissao_negada" });
      if (metodo === "POST") {
        const app = validarAplicativo(await lerCorpo());
        if (!app) return responder(400, { erro: "aplicativo_invalido" });
        await garantirTabelas();
        if (!(await salvarAplicativo(app))) return responder(404, { erro: "aplicativo_nao_encontrado" });
      }
      await garantirTabelas();
      return responder(200, { aplicativos: await listarAplicativos(interno) });
    }
    if (!usuario) return responder(401, { erro: "nao_autenticado" });
    if (!interno) return responder(403, { erro: "permissao_negada" });

    if (acao === "historico-inventario" && metodo === "GET") {
      await garantirTabelas();
      const [historico, atual] = await Promise.all([
        lerHistoricoInventario(),
        lerAssinatura(usuario.id, "inventario"),
      ]);
      return responder(200, {
        ...historico,
        notificacao: dadosDaAssinatura(atual),
      });
    }
    if (acao === "preferencias") {
      await garantirTabelas();
      if (metodo === "POST") {
        const corpo = await lerCorpo();
        if (typeof corpo.fonte !== "string" || !Object.hasOwn(FONTES, corpo.fonte) || typeof corpo.ativa !== "boolean") {
          return responder(400, { erro: "preferencia_invalida" });
        }
        await alterarPreferencia(usuario.id, corpo.fonte as Fonte, corpo.ativa);
      }
      const sql = getDb();
      const preferencias = await sql`SELECT fonte FROM notificacoes_apps_empresa WHERE usuario_id = ${usuario.id}`;
      return responder(200, { fontesAtivas: preferencias.map(({ fonte }) => fonte) });
    }
    if (acao === "notificacoes" && metodo === "POST") {
      const { fonte } = await lerCorpo();
      if (typeof fonte !== "string" || !Object.hasOwn(FONTES, fonte)) return responder(400, { erro: "fonte_invalida" });
      await garantirTabelas();
      return responder(200, { notificacao: await acompanharNotificacoes(usuario.id, fonte as Fonte) });
    }
    return responder(404, { erro: "acao_nao_encontrada" });
  } catch (erro) {
    return responder(503, { erro: erro instanceof InventarioIndisponivel ? erro.message : "aplicativos_indisponiveis" });
  }
}
