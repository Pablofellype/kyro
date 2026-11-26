import type { getDb } from "./autenticacao.ts";
import { acessosPowerBiEfetivos, POWER_BI_RELATORIO_LEGADO, type RelatorioPowerBi } from "../tiposPowerBi.ts";

type Banco = ReturnType<typeof getDb>;
const ID_VALIDO = /^[a-z0-9-]{1,64}$/;
const REPORT_ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

let migracao: Promise<unknown> | undefined;

export function garantirPowerBiEmpresa(sql: Banco) {
  migracao ??= sql.transaction([
    sql`SELECT pg_advisory_xact_lock(192371605, 2)`,
    sql`CREATE TABLE IF NOT EXISTS power_bi_relatorios (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, url TEXT NOT NULL, report_id TEXT NOT NULL UNIQUE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS power_bi_relatorios JSONB`,
    sql`ALTER TABLE tokens_acesso ADD COLUMN IF NOT EXISTS power_bi_relatorios JSONB`,
  ]).catch((erro) => {
    migracao = undefined;
    throw erro;
  });
  return migracao;
}

function urlPowerBi(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length > 4096) return null;
  try {
    const url = new URL(valor.trim());
    if (url.origin !== "https://app.powerbi.com" || url.pathname !== "/reportEmbed" || url.username || url.password) return null;
    return REPORT_ID.test(url.searchParams.get("reportId") ?? "") ? url.href : null;
  } catch {
    return null;
  }
}

function relatoriosDoAmbiente(): RelatorioPowerBi[] {
  const iniciais = [
    { id: POWER_BI_RELATORIO_LEGADO, nome: "Controle de Custos SAP", endereco: process.env.KYRO_POWER_BI_REPORT_URL },
    { id: "relatorio-power-bi-2", nome: "Relatório Power BI 2", endereco: process.env.KYRO_POWER_BI_REPORT_URL_2 },
  ];
  return iniciais.flatMap(({ id, nome, endereco }) => {
    const url = urlPowerBi(endereco);
    return url ? [{ id, nome, url }] : [];
  });
}

export async function listarRelatoriosPowerBi(sql: Banco): Promise<RelatorioPowerBi[]> {
  await garantirPowerBiEmpresa(sql);
  const gravados = await sql`SELECT id, nome, url FROM power_bi_relatorios ORDER BY criado_em, id` as RelatorioPowerBi[];
  const catalogo = new Map(relatoriosDoAmbiente().map((item) => [item.id, item]));
  for (const item of gravados) catalogo.set(item.id, item);
  return [...catalogo.values()];
}

export async function relatoriosPowerBiDaConta(sql: Banco, id: number, dono: boolean): Promise<RelatorioPowerBi[]> {
  const catalogo = await listarRelatoriosPowerBi(sql);
  if (dono) return catalogo;
  const [usuario] = await sql`
    SELECT power_bi_relatorios FROM usuarios
    WHERE id = ${id} AND ativo = TRUE AND perfil IN ('gerencia', 'adm', 'admin', 'administrador')
  `;
  if (!usuario) return [];
  const liberados = acessosPowerBiEfetivos(usuario.power_bi_relatorios as string[] | null | undefined);
  return catalogo.filter((item) => liberados.includes(item.id));
}

export async function salvarRelatorioPowerBi(sql: Banco, dados: Record<string, unknown>) {
  const id = dados.id ?? null;
  const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
  const url = urlPowerBi(dados.url);
  if (!nome || nome.length > 120 || !url || (id !== null && (typeof id !== "string" || !ID_VALIDO.test(id)))) {
    throw new Error("relatorio_power_bi_invalido");
  }
  const catalogo = await listarRelatoriosPowerBi(sql);
  if (id && !catalogo.some((item) => item.id === id)) throw new Error("relatorio_power_bi_nao_encontrado");
  const reportId = new URL(url).searchParams.get("reportId")!.toLowerCase();
  const chave = id ?? `relatorio-${reportId}`;
  if (catalogo.some((item) => item.id !== chave && new URL(item.url).searchParams.get("reportId")?.toLowerCase() === reportId)) {
    throw new Error("relatorio_power_bi_duplicado");
  }
  await sql`
    INSERT INTO power_bi_relatorios (id, nome, url, report_id)
    VALUES (${chave}, ${nome}, ${url}, ${reportId})
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, url = EXCLUDED.url, report_id = EXCLUDED.report_id
  `.catch((erro: unknown) => {
    if (erro && typeof erro === "object" && "code" in erro && erro.code === "23505") throw new Error("relatorio_power_bi_duplicado");
    throw erro;
  });
}

export async function validarAcessosPowerBi(sql: Banco, valor: unknown): Promise<string[]> {
  if (valor === undefined) return [];
  if (!Array.isArray(valor) || valor.length > 200 || valor.some((id) => typeof id !== "string" || !ID_VALIDO.test(id))) {
    throw new Error("acessos_power_bi_invalidos");
  }
  const ids = [...new Set(valor as string[])];
  if (ids.length) {
    const catalogo = new Set((await listarRelatoriosPowerBi(sql)).map((item) => item.id));
    if (ids.some((id) => !catalogo.has(id))) throw new Error("acessos_power_bi_invalidos");
  }
  return ids;
}
