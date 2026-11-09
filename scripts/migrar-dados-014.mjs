import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL nao definida");

const sql = neon(databaseUrl);
await sql`
  CREATE TABLE IF NOT EXISTS solicitacoes_materiais (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    material_id VARCHAR(120) NOT NULL,
    material_nome VARCHAR(160) NOT NULL,
    variacao VARCHAR(160) NOT NULL DEFAULT '',
    quantidade INTEGER NOT NULL CHECK (quantidade > 0 AND quantidade <= 99),
    observacao VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;
await sql`CREATE INDEX IF NOT EXISTS solicitacoes_materiais_usuario_idx ON solicitacoes_materiais (usuario_id, criado_em DESC)`;
console.log("OK solicitacoes_materiais");
