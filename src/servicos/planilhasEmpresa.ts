import type { getDb } from "./autenticacao.ts";
import { planilhaPeloLink, type AjustePlanilha } from "../modulos/escritorio/planilhasDaEmpresa.ts";

type Banco = ReturnType<typeof getDb>;
const ID_ROBO = /^[\w-]{1,200}$/;
const ID_KYRO = /^kyro:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

let migracao: Promise<unknown> | undefined;

function garantirTabela(sql: Banco) {
  migracao ??= sql.transaction([
    sql`SELECT pg_advisory_xact_lock(192371605, 3)`,
    sql`CREATE TABLE IF NOT EXISTS planilhas_empresa (
      id TEXT PRIMARY KEY,
      origem_robo BOOLEAN NOT NULL,
      documento TEXT NOT NULL,
      nome TEXT NOT NULL,
      url TEXT NOT NULL,
      ativa BOOLEAN NOT NULL,
      removida BOOLEAN NOT NULL DEFAULT FALSE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS planilhas_empresa_documento ON planilhas_empresa (documento) WHERE NOT removida`,
  ]).catch((erro) => {
    migracao = undefined;
    throw erro;
  });
  return migracao;
}

export async function listarAjustesPlanilhas(sql: Banco, dono: boolean): Promise<AjustePlanilha[]> {
  await garantirTabela(sql);
  const registros = await sql`
    SELECT id, origem_robo, documento, nome, url, ativa, removida
    FROM planilhas_empresa ORDER BY criado_em, id
  ` as { id: string; origem_robo: boolean; documento: string; nome: string; url: string; ativa: boolean; removida: boolean }[];
  return registros.map((item) => {
    const planilha = planilhaPeloLink(item.nome, item.url);
    if (item.removida || (!dono && !item.ativa) || !planilha) return { id: item.id, oculta: true, documento: item.documento };
    return { ...planilha, id: item.id, origemRobo: item.origem_robo, ativa: item.ativa };
  });
}

export class ErroPlanilhaEmpresa extends Error {
  readonly status: number;

  constructor(status: number, codigo: string) {
    super(codigo);
    this.status = status;
  }
}

export async function alterarPlanilhaEmpresa(sql: Banco, dados: Record<string, unknown>) {
  const { id, acao, origemRobo } = dados;
  if (typeof id !== "string" || typeof origemRobo !== "boolean" || !(origemRobo ? ID_ROBO : ID_KYRO).test(id)) {
    throw new ErroPlanilhaEmpresa(400, "planilha_empresa_invalida");
  }
  if (acao === "remover") {
    await garantirTabela(sql);
    if (origemRobo) {
      // O registro oculto impede que a rotina de origem reinsira a planilha no menu.
      await sql`
        INSERT INTO planilhas_empresa (id, origem_robo, documento, nome, url, ativa, removida)
        VALUES (${id}, TRUE, ${id}, '', '', FALSE, TRUE)
        ON CONFLICT (id) DO UPDATE SET removida = TRUE, ativa = FALSE, nome = '', url = ''
      `;
    } else {
      await sql`UPDATE planilhas_empresa SET removida = TRUE, ativa = FALSE, nome = '', url = '' WHERE id = ${id}`;
    }
    return;
  }

  const { ativa, url } = dados;
  const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
  const planilha = typeof url === "string" ? planilhaPeloLink(nome, url) : null;
  if (!nome || nome.length > 120 || !planilha || typeof ativa !== "boolean"
    || (acao !== "salvar" && acao !== "adicionar") || (acao === "adicionar" && origemRobo)) {
    throw new ErroPlanilhaEmpresa(400, "planilha_empresa_invalida");
  }

  await garantirTabela(sql);
  try {
    if (acao === "adicionar") {
      await sql`
        INSERT INTO planilhas_empresa (id, origem_robo, documento, nome, url, ativa)
        VALUES (${id}, FALSE, ${planilha.id}, ${nome}, ${planilha.url}, ${ativa})
        ON CONFLICT (id) DO NOTHING
      `;
      return;
    }
    const atualizadas = origemRobo ? await sql`
      INSERT INTO planilhas_empresa (id, origem_robo, documento, nome, url, ativa)
      VALUES (${id}, TRUE, ${planilha.id}, ${nome}, ${planilha.url}, ${ativa})
      ON CONFLICT (id) DO UPDATE SET documento = EXCLUDED.documento, nome = EXCLUDED.nome, url = EXCLUDED.url, ativa = EXCLUDED.ativa
      WHERE NOT planilhas_empresa.removida RETURNING id
    ` : await sql`
      UPDATE planilhas_empresa SET documento = ${planilha.id}, nome = ${nome}, url = ${planilha.url}, ativa = ${ativa}
      WHERE id = ${id} AND NOT removida RETURNING id
    `;
    if (!atualizadas.length) throw new ErroPlanilhaEmpresa(404, "planilha_empresa_nao_encontrada");
  } catch (erro) {
    if (erro && typeof erro === "object" && "code" in erro && erro.code === "23505") {
      throw new ErroPlanilhaEmpresa(409, "planilha_empresa_duplicada");
    }
    throw erro;
  }
}
