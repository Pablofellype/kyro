import { getDb } from "./autenticacao.ts";

const CHAVE_VALIDA = /^niko:[a-z0-9_-]{1,60}$/i;
const CLIENTE_ID_VALIDO = /^[a-z0-9:_-]{8,120}$/i;
const TAMANHO_MAXIMO = 20_000_000;

export type ItensDadosUsuario = Record<string, string | null>;

export interface RegistroHistoricoDadosUsuario {
  versao: string;
  operacao: "alteracao" | "zerar";
  chaves: string[];
  clienteId: string | null;
  criadoEm: string;
}

export interface RegistroBackupDadosUsuario {
  id: number;
  versao: string;
  motivo: "alteracao" | "zerar" | "manual";
  itens: number;
  criadoEm: string;
}

const LIMITE_BACKUPS = 30;

export class ConflitoDadosUsuario extends Error {
  public readonly versao: string;
  public readonly dados: Record<string, string>;

  constructor(versao: string, dados: Record<string, string>) {
    super("conflito_sincronizacao");
    this.name = "ConflitoDadosUsuario";
    this.versao = versao;
    this.dados = dados;
  }
}

function validarChave(chave: string) {
  if (!CHAVE_VALIDA.test(chave)) throw new Error("chave_invalida");
}

function normalizarClienteId(clienteId: string | null): string | null {
  if (!clienteId || !CLIENTE_ID_VALIDO.test(clienteId)) return null;
  return clienteId.slice(0, 120);
}

function auditoriaAindaNaoMigrada(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const valor = erro as { code?: unknown; message?: unknown };
  const mensagem = typeof valor.message === "string" ? valor.message : "";
  return valor.code === "42P01" && /dados_usuario_(backups|historico)/i.test(mensagem);
}

export function validarItensDadosUsuario(valor: unknown): ItensDadosUsuario {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("itens_invalidos");
  const itens: ItensDadosUsuario = {};
  for (const [chave, dado] of Object.entries(valor)) {
    validarChave(chave);
    if (dado !== null && typeof dado !== "string") throw new Error("valor_invalido");
    if (typeof dado === "string" && dado.length > TAMANHO_MAXIMO) throw new Error("valor_invalido");
    itens[chave] = dado;
  }
  return itens;
}

export async function lerDadosUsuario(usuarioId: number): Promise<Record<string, string>> {
  return (await lerDadosUsuarioComVersao(usuarioId)).dados;
}

export async function lerDadosUsuarioComVersao(usuarioId: number): Promise<{ dados: Record<string, string>; versao: string }> {
  const sql = getDb();
  await sql`
    INSERT INTO dados_usuario_revisoes (usuario_id, versao)
    VALUES (${usuarioId}, '0')
    ON CONFLICT (usuario_id) DO NOTHING
  `;
  const linhas = await sql`
    SELECT chave, valor
    FROM dados_usuario
    WHERE usuario_id = ${usuarioId}
    ORDER BY chave
  `;
  const revisoes = await sql`
    SELECT versao
    FROM dados_usuario_revisoes
    WHERE usuario_id = ${usuarioId}
    LIMIT 1
  `;
  const versao = String(revisoes[0]?.versao ?? "0");
  return {
    versao,
    dados: Object.fromEntries(linhas.filter((linha) => typeof linha.valor === "string").map((linha) => [linha.chave, linha.valor])),
  };
}

async function gravarSemAuditoria(sql: ReturnType<typeof getDb>, usuarioId: number, itens: ItensDadosUsuario, esperado: string): Promise<string> {
  const resultado = await sql`
    WITH bumped AS (
      UPDATE dados_usuario_revisoes
      SET versao = md5(random()::text || clock_timestamp()::text || usuario_id::text),
          atualizado_em = CURRENT_TIMESTAMP
      WHERE usuario_id = ${usuarioId} AND versao = ${esperado}
      RETURNING usuario_id, versao
    ),
    removidos AS (
      DELETE FROM dados_usuario AS d
      USING jsonb_each(${JSON.stringify(itens)}::jsonb) AS entrada(chave, valor), bumped AS b
      WHERE d.usuario_id = b.usuario_id
        AND d.chave = entrada.chave
        AND entrada.valor = 'null'::jsonb
      RETURNING d.chave
    ),
    gravados AS (
      INSERT INTO dados_usuario (usuario_id, chave, valor, atualizado_em)
      SELECT b.usuario_id, entrada.chave, entrada.valor #>> '{}', CURRENT_TIMESTAMP
      FROM jsonb_each(${JSON.stringify(itens)}::jsonb) AS entrada(chave, valor)
      CROSS JOIN bumped AS b
      WHERE entrada.valor <> 'null'::jsonb
      ON CONFLICT (usuario_id, chave)
      DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = CURRENT_TIMESTAMP
      RETURNING chave
    )
    SELECT (SELECT versao FROM bumped) AS versao
  `;
  const novaVersao = String(resultado[0]?.versao ?? "");
  if (novaVersao) return novaVersao;
  const atual = await lerDadosUsuarioComVersao(usuarioId);
  throw new ConflitoDadosUsuario(atual.versao, atual.dados);
}

async function zerarSemAuditoria(sql: ReturnType<typeof getDb>, usuarioId: number, esperado: string): Promise<string> {
  const resultado = await sql`
    WITH bumped AS (
      UPDATE dados_usuario_revisoes
      SET versao = md5(random()::text || clock_timestamp()::text || usuario_id::text),
          atualizado_em = CURRENT_TIMESTAMP
      WHERE usuario_id = ${usuarioId} AND versao = ${esperado}
      RETURNING usuario_id, versao
    ),
    apagados AS (
      DELETE FROM dados_usuario AS d
      USING bumped AS b
      WHERE d.usuario_id = b.usuario_id
      RETURNING d.chave
    )
    SELECT (SELECT versao FROM bumped) AS versao
  `;
  const novaVersao = String(resultado[0]?.versao ?? "");
  if (novaVersao) return novaVersao;
  const atual = await lerDadosUsuarioComVersao(usuarioId);
  throw new ConflitoDadosUsuario(atual.versao, atual.dados);
}

export async function gravarDadosUsuario(usuarioId: number, bruto: unknown, versaoEsperada: string | null = null, clienteId: string | null = null): Promise<string> {
  const itens = validarItensDadosUsuario(bruto);
  const sql = getDb();
  const esperado = versaoEsperada ?? (await lerDadosUsuarioComVersao(usuarioId)).versao;
  const cliente = normalizarClienteId(clienteId);
  try {
    const resultado = await sql`
    WITH bumped AS (
      UPDATE dados_usuario_revisoes
      SET versao = md5(random()::text || clock_timestamp()::text || usuario_id::text),
          atualizado_em = CURRENT_TIMESTAMP
      WHERE usuario_id = ${usuarioId} AND versao = ${esperado}
      RETURNING usuario_id, versao
    ),
    backup AS (
      INSERT INTO dados_usuario_backups (usuario_id, versao, motivo, dados, cliente_id, criado_em)
      SELECT b.usuario_id, b.versao, 'alteracao',
        COALESCE((SELECT jsonb_object_agg(d.chave, d.valor) FROM dados_usuario AS d WHERE d.usuario_id = b.usuario_id), '{}'::jsonb),
        ${cliente}, CURRENT_TIMESTAMP
      FROM bumped AS b
      RETURNING id
    ),
    removidos AS (
      DELETE FROM dados_usuario AS d
      USING jsonb_each(${JSON.stringify(itens)}::jsonb) AS entrada(chave, valor), bumped AS b
      WHERE d.usuario_id = b.usuario_id
        AND d.chave = entrada.chave
        AND entrada.valor = 'null'::jsonb
      RETURNING d.chave
    ),
    gravados AS (
      INSERT INTO dados_usuario (usuario_id, chave, valor, atualizado_em)
      SELECT b.usuario_id, entrada.chave, entrada.valor #>> '{}', CURRENT_TIMESTAMP
      FROM jsonb_each(${JSON.stringify(itens)}::jsonb) AS entrada(chave, valor)
      CROSS JOIN bumped AS b
      WHERE entrada.valor <> 'null'::jsonb
      ON CONFLICT (usuario_id, chave)
      DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = CURRENT_TIMESTAMP
      RETURNING chave
    ),
    historico AS (
      INSERT INTO dados_usuario_historico (usuario_id, versao, operacao, chaves, cliente_id, criado_em)
      SELECT b.usuario_id, b.versao, 'alteracao',
        to_jsonb(ARRAY(SELECT entrada.chave FROM jsonb_object_keys(${JSON.stringify(itens)}::jsonb) AS entrada(chave))),
        ${cliente}, CURRENT_TIMESTAMP
      FROM bumped AS b
      RETURNING id
    ),
    limpeza AS (
      DELETE FROM dados_usuario_backups AS antigo
      WHERE antigo.usuario_id = ${usuarioId}
        AND antigo.id NOT IN (SELECT id FROM backup)
        AND antigo.id NOT IN (
          SELECT id
          FROM dados_usuario_backups
          WHERE usuario_id = ${usuarioId}
          ORDER BY criado_em DESC, id DESC
          LIMIT ${LIMITE_BACKUPS - 1}
        )
      RETURNING antigo.id
    )
    SELECT (SELECT versao FROM bumped) AS versao, (SELECT COUNT(*) FROM historico) AS auditado, (SELECT COUNT(*) FROM backup) AS backup, (SELECT COUNT(*) FROM limpeza) AS limpos
    `;
    const novaVersao = String(resultado[0]?.versao ?? "");
    if (novaVersao) return novaVersao;
    const atual = await lerDadosUsuarioComVersao(usuarioId);
    throw new ConflitoDadosUsuario(atual.versao, atual.dados);
  } catch (erro) {
    // A versão 0.2.11 adicionou auditoria, mas bancos já existentes podem
    // ainda estar entre as migrações. A sincronização principal não pode
    // ficar travada só porque o histórico ainda não foi criado.
    if (auditoriaAindaNaoMigrada(erro)) return gravarSemAuditoria(sql, usuarioId, itens, esperado);
    throw erro;
  }
}

export async function zerarDadosUsuario(usuarioId: number, versaoEsperada: string | null = null, clienteId: string | null = null): Promise<string> {
  const sql = getDb();
  const esperado = versaoEsperada ?? (await lerDadosUsuarioComVersao(usuarioId)).versao;
  const cliente = normalizarClienteId(clienteId);
  try {
    const resultado = await sql`
    WITH bumped AS (
      UPDATE dados_usuario_revisoes
      SET versao = md5(random()::text || clock_timestamp()::text || usuario_id::text),
          atualizado_em = CURRENT_TIMESTAMP
      WHERE usuario_id = ${usuarioId} AND versao = ${esperado}
      RETURNING usuario_id, versao
    ),
    backup AS (
      INSERT INTO dados_usuario_backups (usuario_id, versao, motivo, dados, cliente_id, criado_em)
      SELECT b.usuario_id, b.versao, 'zerar',
        COALESCE((SELECT jsonb_object_agg(d.chave, d.valor) FROM dados_usuario AS d WHERE d.usuario_id = b.usuario_id), '{}'::jsonb),
        ${cliente}, CURRENT_TIMESTAMP
      FROM bumped AS b
      RETURNING id
    ),
    apagados AS (
      DELETE FROM dados_usuario AS d
      USING bumped AS b
      WHERE d.usuario_id = b.usuario_id
      RETURNING d.chave
    ),
    historico AS (
      INSERT INTO dados_usuario_historico (usuario_id, versao, operacao, chaves, cliente_id, criado_em)
      SELECT b.usuario_id, b.versao, 'zerar', '[]'::jsonb, ${cliente}, CURRENT_TIMESTAMP
      FROM bumped AS b
      RETURNING id
    ),
    limpeza AS (
      DELETE FROM dados_usuario_backups AS antigo
      WHERE antigo.usuario_id = ${usuarioId}
        AND antigo.id NOT IN (SELECT id FROM backup)
        AND antigo.id NOT IN (
          SELECT id
          FROM dados_usuario_backups
          WHERE usuario_id = ${usuarioId}
          ORDER BY criado_em DESC, id DESC
          LIMIT ${LIMITE_BACKUPS - 1}
        )
      RETURNING antigo.id
    )
    SELECT (SELECT versao FROM bumped) AS versao, (SELECT COUNT(*) FROM historico) AS auditado, (SELECT COUNT(*) FROM backup) AS backup, (SELECT COUNT(*) FROM limpeza) AS limpos
    `;
    const novaVersao = String(resultado[0]?.versao ?? "");
    if (novaVersao) return novaVersao;
    const atual = await lerDadosUsuarioComVersao(usuarioId);
    throw new ConflitoDadosUsuario(atual.versao, atual.dados);
  } catch (erro) {
    if (auditoriaAindaNaoMigrada(erro)) return zerarSemAuditoria(sql, usuarioId, esperado);
    throw erro;
  }
}

export async function lerHistoricoDadosUsuario(usuarioId: number, limite = 30): Promise<RegistroHistoricoDadosUsuario[]> {
  const sql = getDb();
  const limiteSeguro = Math.max(1, Math.min(100, Math.floor(Number(limite) || 30)));
  let linhas;
  try {
    linhas = await sql`
      SELECT versao, operacao, chaves, cliente_id, criado_em
      FROM dados_usuario_historico
      WHERE usuario_id = ${usuarioId}
      ORDER BY criado_em DESC, id DESC
      LIMIT ${limiteSeguro}
    `;
  } catch (erro) {
    if (auditoriaAindaNaoMigrada(erro)) return [];
    throw erro;
  }
  return linhas.map((linha) => ({
    versao: String(linha.versao ?? ""),
    operacao: linha.operacao === "zerar" ? "zerar" : "alteracao",
    chaves: Array.isArray(linha.chaves) ? linha.chaves.filter((chave): chave is string => typeof chave === "string").slice(0, 500) : [],
    clienteId: typeof linha.cliente_id === "string" ? linha.cliente_id : null,
    criadoEm: new Date(linha.criado_em).toISOString(),
  }));
}

export async function lerBackupsDadosUsuario(usuarioId: number, limite = LIMITE_BACKUPS): Promise<RegistroBackupDadosUsuario[]> {
  const sql = getDb();
  const limiteSeguro = Math.max(1, Math.min(LIMITE_BACKUPS, Math.floor(Number(limite) || LIMITE_BACKUPS)));
  let linhas;
  try {
    linhas = await sql`
      SELECT id, versao, motivo, jsonb_object_length(dados) AS itens, criado_em
      FROM dados_usuario_backups
      WHERE usuario_id = ${usuarioId}
      ORDER BY criado_em DESC, id DESC
      LIMIT ${limiteSeguro}
    `;
  } catch (erro) {
    if (auditoriaAindaNaoMigrada(erro)) return [];
    throw erro;
  }
  return linhas.map((linha) => ({
    id: Number(linha.id),
    versao: String(linha.versao ?? ""),
    motivo: linha.motivo === "zerar" ? "zerar" : linha.motivo === "manual" ? "manual" : "alteracao",
    itens: Number(linha.itens ?? 0),
    criadoEm: new Date(linha.criado_em).toISOString(),
  }));
}

export async function restaurarBackupDadosUsuario(usuarioId: number, backupId: number, versaoEsperada: string | null = null, clienteId: string | null = null): Promise<string> {
  if (!Number.isSafeInteger(backupId) || backupId <= 0) throw new Error("backup_invalido");
  const sql = getDb();
  const esperado = versaoEsperada ?? (await lerDadosUsuarioComVersao(usuarioId)).versao;
  const cliente = normalizarClienteId(clienteId);
  const resultado = await sql`
    WITH origem AS (
      SELECT dados
      FROM dados_usuario_backups
      WHERE id = ${backupId} AND usuario_id = ${usuarioId}
      LIMIT 1
    ),
    bumped AS (
      UPDATE dados_usuario_revisoes
      SET versao = md5(random()::text || clock_timestamp()::text || usuario_id::text),
          atualizado_em = CURRENT_TIMESTAMP
      WHERE usuario_id = ${usuarioId}
        AND versao = ${esperado}
        AND EXISTS (SELECT 1 FROM origem)
      RETURNING usuario_id, versao
    ),
    backup_atual AS (
      INSERT INTO dados_usuario_backups (usuario_id, versao, motivo, dados, cliente_id, criado_em)
      SELECT b.usuario_id, b.versao, 'manual',
        COALESCE((SELECT jsonb_object_agg(d.chave, d.valor) FROM dados_usuario AS d WHERE d.usuario_id = b.usuario_id), '{}'::jsonb),
        ${cliente}, CURRENT_TIMESTAMP
      FROM bumped AS b
      RETURNING id
    ),
    apagados AS (
      DELETE FROM dados_usuario AS d
      USING bumped AS b
      WHERE d.usuario_id = b.usuario_id
      RETURNING d.chave
    ),
    gravados AS (
      INSERT INTO dados_usuario (usuario_id, chave, valor, atualizado_em)
      SELECT b.usuario_id, entrada.chave, entrada.valor, CURRENT_TIMESTAMP
      FROM origem AS o
      CROSS JOIN jsonb_each_text(o.dados) AS entrada(chave, valor)
      CROSS JOIN bumped AS b
      ON CONFLICT (usuario_id, chave)
      DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = CURRENT_TIMESTAMP
      RETURNING chave
    ),
    historico AS (
      INSERT INTO dados_usuario_historico (usuario_id, versao, operacao, chaves, cliente_id, criado_em)
      SELECT b.usuario_id, b.versao, 'alteracao',
        to_jsonb(ARRAY(SELECT entrada.chave FROM origem AS o CROSS JOIN jsonb_object_keys(o.dados) AS entrada(chave))),
        ${cliente}, CURRENT_TIMESTAMP
      FROM bumped AS b
      RETURNING id
    ),
    limpeza AS (
      DELETE FROM dados_usuario_backups AS antigo
      WHERE antigo.usuario_id = ${usuarioId}
        AND antigo.id NOT IN (SELECT id FROM backup_atual)
        AND antigo.id NOT IN (
          SELECT id
          FROM dados_usuario_backups
          WHERE usuario_id = ${usuarioId}
          ORDER BY criado_em DESC, id DESC
          LIMIT ${LIMITE_BACKUPS - 1}
        )
      RETURNING antigo.id
    )
    SELECT (SELECT versao FROM bumped) AS versao, (SELECT COUNT(*) FROM origem) AS encontrado, (SELECT COUNT(*) FROM historico) AS auditado, (SELECT COUNT(*) FROM backup_atual) AS backup
  `;
  const linha = resultado[0];
  const novaVersao = String(linha?.versao ?? "");
  if (novaVersao) return novaVersao;
  if (Number(linha?.encontrado ?? 0) === 0) throw new Error("backup_nao_encontrado");
  const atual = await lerDadosUsuarioComVersao(usuarioId);
  throw new ConflitoDadosUsuario(atual.versao, atual.dados);
}
