import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL nao definida");

const sql = neon(databaseUrl);

await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo VARCHAR(120)`;
await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS setor VARCHAR(120)`;
await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(40)`;
await sql`ALTER TABLE tokens_acesso ADD COLUMN IF NOT EXISTS cargo VARCHAR(120)`;
await sql`ALTER TABLE tokens_acesso ADD COLUMN IF NOT EXISTS setor VARCHAR(120)`;
await sql`ALTER TABLE tokens_acesso ADD COLUMN IF NOT EXISTS telefone VARCHAR(40)`;

console.log("OK perfil profissional dos usuarios");
