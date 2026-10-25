import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

await sql`
  CREATE TABLE IF NOT EXISTS dados_usuario_historico (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    versao VARCHAR(64) NOT NULL,
    operacao VARCHAR(20) NOT NULL CHECK (operacao IN ('alteracao', 'zerar')),
    chaves JSONB NOT NULL DEFAULT '[]'::jsonb,
    cliente_id VARCHAR(120),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS dados_usuario_historico_usuario_data_idx
  ON dados_usuario_historico (usuario_id, criado_em DESC, id DESC)
`;

const tabelas = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'dados_usuario_historico'
`;
console.log(`OK dados_usuario_historico (${tabelas.length ? "criada ou existente" : "não encontrada"})`);
