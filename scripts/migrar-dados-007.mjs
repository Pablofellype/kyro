import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

await sql`
  CREATE TABLE IF NOT EXISTS dados_usuario_revisoes (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    versao VARCHAR(64) NOT NULL DEFAULT '0',
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

await sql`
  INSERT INTO dados_usuario_revisoes (usuario_id, versao)
  SELECT id, '0'
  FROM usuarios
  ON CONFLICT (usuario_id) DO NOTHING
`;

const revisoes = await sql`
  SELECT COUNT(*)::integer AS total
  FROM dados_usuario_revisoes
`;
console.log(`OK dados_usuario_revisoes (${revisoes[0]?.total ?? 0} usuários)`);
