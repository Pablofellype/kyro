import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil VARCHAR(20) NOT NULL DEFAULT 'usuario'`;
await sql`
  UPDATE usuarios
  SET perfil = 'dono'
  WHERE id = (SELECT MIN(id) FROM usuarios)
    AND NOT EXISTS (SELECT 1 FROM usuarios WHERE perfil = 'dono')
`;

await sql`
  CREATE TABLE IF NOT EXISTS tokens_acesso (
    token_hash VARCHAR(64) PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('convite', 'recuperacao')),
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    nome VARCHAR(160) NOT NULL DEFAULT '',
    expira_em TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;
await sql`
  CREATE INDEX IF NOT EXISTS tokens_acesso_email_tipo_idx
  ON tokens_acesso (email, tipo, expira_em DESC)
`;
await sql`
  DELETE FROM tokens_acesso
  WHERE expira_em < CURRENT_TIMESTAMP - INTERVAL '24 hours'
`;

const perfil = await sql`
  SELECT id, email, perfil
  FROM usuarios
  WHERE perfil = 'dono'
  ORDER BY id
`;
const tabelas = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'tokens_acesso'
`;
console.log(`OK tokens_acesso (${tabelas.length ? "criada ou existente" : "não encontrada"})`);
console.log(`OK perfil_dono (${perfil.length ? `${perfil.length} dono(s)` : "nenhum usuário encontrado"})`);
