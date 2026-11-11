import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, validarSessao } from "../src/servicos/autenticacao.js";
import { configurarCors } from "./cors.js";

let tabelaPronta: Promise<void> | null = null;

function tokenDaRequisicao(req: VercelRequest): string {
  const valor = req.headers.authorization;
  return typeof valor === "string" && valor.startsWith("Bearer ") ? valor.slice(7).trim() : req.cookies?.kyro_token ?? "";
}

function garantirTabela(): Promise<void> {
  if (!tabelaPronta) {
    const sql = getDb();
    tabelaPronta = sql`
      CREATE TABLE IF NOT EXISTS solicitacoes_materiais (
        id BIGSERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        material_id VARCHAR(120) NOT NULL,
        material_nome VARCHAR(160) NOT NULL,
        variacao VARCHAR(160) NOT NULL DEFAULT '',
        quantidade INTEGER NOT NULL CHECK (quantidade > 0 AND quantidade <= 99),
        observacao VARCHAR(500) NOT NULL DEFAULT '',
        visitante_nome VARCHAR(160) NOT NULL DEFAULT '',
        visitante_email VARCHAR(320) NOT NULL DEFAULT '',
        status VARCHAR(30) NOT NULL DEFAULT 'pendente',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `.then(async () => {
      await sql`ALTER TABLE solicitacoes_materiais ALTER COLUMN usuario_id DROP NOT NULL`;
      await sql`ALTER TABLE solicitacoes_materiais ADD COLUMN IF NOT EXISTS visitante_nome VARCHAR(160) NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE solicitacoes_materiais ADD COLUMN IF NOT EXISTS visitante_email VARCHAR(320) NOT NULL DEFAULT ''`;
    }).catch((erro) => {
      tabelaPronta = null;
      throw erro;
    });
  }
  return tabelaPronta;
}

function texto(valor: unknown, limite: number): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurarCors(req, res)) return res.status(403).json({ erro: "origem_nao_permitida" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ erro: "metodo_nao_permitido" });

  const token = tokenDaRequisicao(req);
  const usuario = token ? await validarSessao(token) : null;
  const publico = req.method === "POST" && req.body?.publico === true;
  if (!usuario && !publico) return res.status(401).json({ erro: "nao_autenticado" });

  try {
    await garantirTabela();
    const sql = getDb();
    if (req.method === "GET") {
      if (!usuario) return res.status(401).json({ erro: "nao_autenticado" });
      const pedidos = usuario.perfil === "dono" || usuario.perfil === "gerencia"
        ? await sql`SELECT s.id, s.usuario_id, u.nome AS solicitante, s.visitante_nome, s.visitante_email, s.material_id, s.material_nome, s.variacao, s.quantidade, s.observacao, s.status, s.criado_em FROM solicitacoes_materiais s LEFT JOIN usuarios u ON u.id = s.usuario_id ORDER BY s.criado_em DESC LIMIT 100`
        : await sql`SELECT id, usuario_id, material_id, material_nome, variacao, quantidade, observacao, status, criado_em FROM solicitacoes_materiais WHERE usuario_id = ${usuario.id} ORDER BY criado_em DESC LIMIT 50`;
      return res.status(200).json({ solicitacoes: pedidos });
    }

    const materialId = texto(req.body?.materialId, 120);
    const materialNome = texto(req.body?.materialNome, 160);
    const variacao = texto(req.body?.variacao, 160);
    const observacao = texto(req.body?.observacao, 500);
    const visitanteNome = texto(req.body?.visitanteNome, 160);
    const visitanteEmail = texto(req.body?.visitanteEmail, 320);
    const quantidade = Number(req.body?.quantidade);
    if (!materialId || !materialNome) return res.status(400).json({ erro: "material_invalido" });
    if (publico && !visitanteNome) return res.status(400).json({ erro: "nome_obrigatorio" });
    if (visitanteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitanteEmail)) return res.status(400).json({ erro: "email_invalido" });
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) return res.status(400).json({ erro: "quantidade_invalida" });
    const inserido = await sql`
      INSERT INTO solicitacoes_materiais (usuario_id, material_id, material_nome, variacao, quantidade, observacao, visitante_nome, visitante_email)
      VALUES (${usuario?.id ?? null}, ${materialId}, ${materialNome}, ${variacao}, ${quantidade}, ${observacao}, ${publico ? visitanteNome : ""}, ${publico ? visitanteEmail : ""})
      RETURNING id
    `;
    const id = String(inserido[0]?.id ?? "");
    return res.status(201).json({ sucesso: true, protocolo: `MAT-${id.padStart(6, "0")}` });
  } catch (erro) {
    return res.status(503).json({ erro: (erro as Error).message || "banco_nao_atualizado" });
  }
}
