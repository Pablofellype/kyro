import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS robo_aderencias BOOLEAN NOT NULL DEFAULT FALSE`;
await sql`UPDATE usuarios SET robo_aderencias = TRUE WHERE perfil = 'dono'`;

console.log("OK permissao_robo_aderencias");
