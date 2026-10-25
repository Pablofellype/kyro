import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

await sql`
  CREATE TABLE IF NOT EXISTS tentativas_login (
    chave VARCHAR(64) PRIMARY KEY,
    tentativas INTEGER NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
    janela_inicio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bloqueado_ate TIMESTAMPTZ,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`
  DELETE FROM tentativas_login
  WHERE atualizado_em < CURRENT_TIMESTAMP - INTERVAL '24 hours'
`;

const tabelas = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'tentativas_login'
`;
console.log(`OK tentativas_login (${tabelas.length ? "criada ou existente" : "não encontrada"})`);
