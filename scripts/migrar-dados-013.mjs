import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL nao definida");

const sql = neon(databaseUrl);

await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil VARCHAR(20) NOT NULL DEFAULT 'visitante'`;
await sql`UPDATE usuarios SET perfil = CASE WHEN perfil = 'dono' THEN 'dono' WHEN perfil IN ('adm', 'admin', 'administrador', 'gerencia') THEN 'gerencia' ELSE 'visitante' END`;
await sql`UPDATE usuarios SET perfil = 'visitante' WHERE perfil = 'dono' AND LOWER(BTRIM(email)) <> 'pablofellype03@gmail.com'`;
await sql`UPDATE usuarios SET perfil = 'dono' WHERE LOWER(BTRIM(email)) = 'pablofellype03@gmail.com'`;
await sql`UPDATE usuarios SET perfil = 'gerencia' WHERE LOWER(BTRIM(email)) = 'pabloflp50@gmail.com' OR LOWER(BTRIM(nome)) LIKE '%ronaldo%'`;
await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo VARCHAR(120)`;
await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS setor VARCHAR(120)`;
await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(40)`;
await sql`ALTER TABLE tokens_acesso ADD COLUMN IF NOT EXISTS cargo VARCHAR(120)`;
await sql`ALTER TABLE tokens_acesso ADD COLUMN IF NOT EXISTS setor VARCHAR(120)`;
await sql`ALTER TABLE tokens_acesso ADD COLUMN IF NOT EXISTS telefone VARCHAR(40)`;
await sql`ALTER TABLE tokens_acesso ADD COLUMN IF NOT EXISTS perfil VARCHAR(20) NOT NULL DEFAULT 'gerencia'`;
await sql`UPDATE tokens_acesso SET perfil = 'gerencia' WHERE tipo = 'convite'`;

console.log("OK perfil profissional dos usuarios");
