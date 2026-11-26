import { randomUUID } from "node:crypto";
import { getDb, validarSessao } from "./autenticacao.ts";
import { chaveDaSolicitacaoMaterial, consultarInventario, InventarioIndisponivel, lerFotoDoInventario, lerReservasInventario, retomarConsultaInventario, unirSolicitacoesMaterial, type SolicitacaoMaterialRecebida } from "./inventarioIntegracao.ts";
import { APLICATIVOS_EMPRESA, STATUS_APLICATIVO, type AplicativoEmpresa, type PropostaAplicativo, type StatusAplicativo } from "../modulos/escritorio/aplicativosEmpresaConfig.ts";
import { autorizarUploadProposta, confirmarArquivosProposta, ErroProposta, lerArquivoProposta, tipoPropostaValido, validarProposta, type ArquivoProposta } from "./propostasAplicativos.ts";
import { relatoriosPowerBiDaConta, salvarRelatorioPowerBi } from "./powerBiEmpresa.ts";
import { POWER_BI_RELATORIO_LEGADO } from "../tiposPowerBi.ts";
import { alterarPlanilhaEmpresa, ErroPlanilhaEmpresa, listarAjustesPlanilhas } from "./planilhasEmpresa.ts";
import type { criarInventarioLocal } from "../../servidor/inventarioLocal.ts";

let tabelasProntas: Promise<unknown> | undefined;

function garantirTabelas() {
  if (tabelasProntas) return tabelasProntas;
  const sql = getDb();
  tabelasProntas = sql.transaction([
    sql`SELECT pg_advisory_xact_lock(192371605, 1)`,
    sql`CREATE TABLE IF NOT EXISTS aplicativos_empresa (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL, url TEXT,
      status TEXT NOT NULL CONSTRAINT aplicativos_empresa_status_valido CHECK (status IN ('disponivel', 'manutencao', 'prototipo')),
      publico BOOLEAN NOT NULL, proposta JSONB NOT NULL DEFAULT '{}'::jsonb,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    sql`ALTER TABLE aplicativos_empresa ADD COLUMN IF NOT EXISTS proposta JSONB NOT NULL DEFAULT '{}'::jsonb`,
    sql`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'aplicativos_empresa'::regclass AND conname = 'aplicativos_empresa_status_valido') THEN
          ALTER TABLE aplicativos_empresa DROP CONSTRAINT IF EXISTS aplicativos_empresa_status_check;
          ALTER TABLE aplicativos_empresa ADD CONSTRAINT aplicativos_empresa_status_valido CHECK (status IN ('disponivel', 'manutencao', 'prototipo'));
        END IF;
      END $$`,
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
  const gravados = await sql`SELECT id, nome, descricao, url, status, publico, proposta FROM aplicativos_empresa ORDER BY criado_em, id` as AplicativoEmpresa[];
  const catalogo = new Map(APLICATIVOS_EMPRESA.map((app) => [app.id, app]));
  for (const app of gravados) catalogo.set(app.id, app);
  if (interno) return [...catalogo.values()];
  return [...catalogo.values()].filter((app) => app.publico).map(({ proposta, ...app }) => ({
    ...app, url: app.status === "prototipo" ? null : app.url,
  }));
}

const idValido = (valor: unknown): valor is string => typeof valor === "string" && /^[a-z0-9-]{1,64}$/.test(valor);

function validarAplicativo(corpo: Record<string, unknown>):
  (Omit<AplicativoEmpresa, "id"> & { id: string | null; criacaoId?: string }) | null {
  const id = corpo.id ?? null;
  if (id !== null && !idValido(id)) return null;
  const criacaoId = corpo.criacaoId;
  if (id === null && (typeof criacaoId !== "string" || !/^[a-z0-9-]{8,60}$/.test(criacaoId))) return null;
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const descricao = typeof corpo.descricao === "string" ? corpo.descricao.trim() : "";
  const status = corpo.status;
  if (!nome || nome.length > 80 || descricao.length > 240 || typeof corpo.publico !== "boolean") return null;
  if (typeof status !== "string" || !Object.hasOwn(STATUS_APLICATIVO, status)) return null;
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
  return {
    id, criacaoId: typeof criacaoId === "string" ? criacaoId : undefined, nome, descricao, url: url?.href ?? null,
    status: status as StatusAplicativo, publico: corpo.publico, proposta: validarProposta(corpo.proposta, id ?? `app-${criacaoId}`),
  };
}

async function lerPropostaSalva(id: string) {
  const sql = getDb();
  const [salvo] = await sql`SELECT proposta FROM aplicativos_empresa WHERE id = ${id}` as { proposta: PropostaAplicativo }[];
  return salvo;
}

async function salvarAplicativo(app: NonNullable<ReturnType<typeof validarAplicativo>>) {
  const sql = getDb();
  const id = app.id ?? `app-${app.criacaoId}`;
  const salvo = await lerPropostaSalva(id);
  if (!app.id && salvo) return true;
  if (app.id && !salvo && !APLICATIVOS_EMPRESA.some((padrao) => padrao.id === id)) return false;
  await confirmarArquivosProposta(app.proposta, salvo?.proposta);
  const proposta = JSON.stringify(app.proposta ?? {});
  if (!app.id) {
    await sql`
      INSERT INTO aplicativos_empresa (id, nome, descricao, url, status, publico, proposta)
      VALUES (${id}, ${app.nome}, ${app.descricao}, ${app.url}, ${app.status}, ${app.publico}, ${proposta}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
    return true;
  }
  await sql`
    INSERT INTO aplicativos_empresa (id, nome, descricao, url, status, publico, proposta)
    VALUES (${id}, ${app.nome}, ${app.descricao}, ${app.url}, ${app.status}, ${app.publico}, ${proposta}::jsonb)
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,
      url = EXCLUDED.url, status = EXCLUDED.status, publico = EXCLUDED.publico,
      proposta = CASE WHEN ${app.proposta === undefined} THEN aplicativos_empresa.proposta ELSE EXCLUDED.proposta END
  `;
  return true;
}

const FONTES = {
  inventario: { consultar: consultarInventario, acompanhar: retomarConsultaInventario },
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
  const { cursor, solicitacoes, reiniciado } = await FONTES[fonte].acompanhar(anterior.cursor);
  const sql = getDb();
  if (cursor !== anterior.cursor || reiniciado || !anterior.contagem) {
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

type Resposta = { status: number; dados: unknown; arquivo?: ArquivoProposta };

export async function tratarAplicativosEmpresa(
  metodo: string | undefined, acao: string | null, token: string, lerCorpo: () => Promise<Record<string, unknown>>,
  parametros?: URLSearchParams, inventarioLocal?: ReturnType<typeof criarInventarioLocal>,
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

    if (acao === "planilhas-catalogo") {
      const dono = usuario.perfil === "dono";
      if (!dono && (metodo === "POST" || !usuario.roboAderencias)) return responder(403, { erro: "permissao_negada" });
      const sql = getDb();
      if (metodo === "POST") await alterarPlanilhaEmpresa(sql, await lerCorpo());
      return responder(200, { ajustes: await listarAjustesPlanilhas(sql, dono) });
    }

    if (acao === "proposta-upload") {
      if (metodo !== "POST") return responder(405, { erro: "metodo_nao_permitido" });
      if (usuario.perfil !== "dono") return responder(403, { erro: "permissao_negada" });
      const { id, tipo } = await lerCorpo();
      if (!idValido(id) || !tipoPropostaValido(tipo)) return responder(400, { erro: "proposta_invalida" });
      return responder(200, await autorizarUploadProposta(id, tipo));
    }
    if (acao === "proposta-arquivo") {
      if (metodo !== "GET") return responder(405, { erro: "metodo_nao_permitido" });
      const id = parametros?.get("app"), tipo = parametros?.get("tipo");
      if (!idValido(id) || !tipoPropostaValido(tipo)) return responder(400, { erro: "proposta_invalida" });
      await garantirTabelas();
      const salvo = await lerPropostaSalva(id);
      const arquivo = await lerArquivoProposta(id, tipo, salvo?.proposta?.[tipo]);
      return arquivo ? { status: 200, dados: null, arquivo } : responder(404, { erro: "arquivo_proposta_nao_encontrado" });
    }
    if (acao === "power-bi" || acao === "power-bi-catalogo") {
      if (metodo === "POST") {
        if (acao === "power-bi") return responder(405, { erro: "metodo_nao_permitido" });
        if (usuario.perfil !== "dono") return responder(403, { erro: "permissao_negada" });
        try {
          await salvarRelatorioPowerBi(getDb(), await lerCorpo());
        } catch (erro) {
          const codigo = erro instanceof Error ? erro.message : "";
          if (codigo === "relatorio_power_bi_invalido") return responder(400, { erro: codigo });
          if (codigo === "relatorio_power_bi_duplicado") return responder(409, { erro: codigo });
          if (codigo === "relatorio_power_bi_nao_encontrado") return responder(404, { erro: codigo });
          throw erro;
        }
      }
      const relatorios = await relatoriosPowerBiDaConta(getDb(), usuario.id, usuario.perfil === "dono");
      if (acao === "power-bi-catalogo") return responder(200, { relatorios });
      const legado = relatorios.find((item) => item.id === POWER_BI_RELATORIO_LEGADO);
      if (legado) return responder(200, { url: legado.url });
      return usuario.perfil === "dono"
        ? responder(503, { erro: "power_bi_nao_configurado" })
        : responder(403, { erro: "permissao_negada" });
    }
    if (acao === "historico-inventario" && metodo === "GET") {
      if (inventarioLocal) return responder(200, { ...await inventarioLocal.historico(), notificacao: inventarioLocal.notificacao(usuario.id) });
      await garantirTabelas();
      const [historico, atual] = await Promise.all([
        lerReservasInventario(),
        lerAssinatura(usuario.id, "inventario"),
      ]);
      return responder(200, {
        ...historico,
        notificacao: dadosDaAssinatura(atual),
      });
    }
    if (acao === "foto-inventario" && metodo === "POST") {
      const { evento, protocolo } = await lerCorpo();
      const foto = await (inventarioLocal ? inventarioLocal.foto(evento, protocolo) : lerFotoDoInventario(evento, undefined, protocolo));
      return foto ? responder(200, { foto }) : responder(404, { erro: "foto_nao_encontrada" });
    }
    if (acao === "preferencias") {
      if (metodo === "POST") {
        const corpo = await lerCorpo();
        if (typeof corpo.fonte !== "string" || !Object.hasOwn(FONTES, corpo.fonte) || typeof corpo.ativa !== "boolean") {
          return responder(400, { erro: "preferencia_invalida" });
        }
        if (inventarioLocal) inventarioLocal.alterarPreferencia(usuario.id, corpo.ativa);
        else {
          await garantirTabelas();
          await alterarPreferencia(usuario.id, corpo.fonte as Fonte, corpo.ativa);
        }
      }
      if (inventarioLocal) return responder(200, { fontesAtivas: inventarioLocal.ativa(usuario.id) ? ["inventario"] : [] });
      await garantirTabelas();
      const sql = getDb();
      const preferencias = await sql`SELECT fonte FROM notificacoes_apps_empresa WHERE usuario_id = ${usuario.id}`;
      return responder(200, { fontesAtivas: preferencias.map(({ fonte }) => fonte) });
    }
    if (acao === "notificacoes" && metodo === "POST") {
      const { fonte } = await lerCorpo();
      if (typeof fonte !== "string" || !Object.hasOwn(FONTES, fonte)) return responder(400, { erro: "fonte_invalida" });
      if (inventarioLocal) return responder(200, { notificacao: await inventarioLocal.acompanhar(usuario.id) });
      await garantirTabelas();
      return responder(200, { notificacao: await acompanharNotificacoes(usuario.id, fonte as Fonte) });
    }
    return responder(404, { erro: "acao_nao_encontrada" });
  } catch (erro) {
    if (erro instanceof ErroProposta || erro instanceof ErroPlanilhaEmpresa) return responder(erro.status, { erro: erro.message });
    return responder(503, { erro: erro instanceof InventarioIndisponivel ? erro.message : "aplicativos_indisponiveis" });
  }
}
