import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

const comandos = [
  ["dias_journal", `
    CREATE TABLE IF NOT EXISTS dias_journal (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      data DATE NOT NULL,
      humor VARCHAR(20) CHECK (humor IS NULL OR humor IN ('otimo', 'bom', 'neutro', 'dificil')),
      sono NUMERIC(6, 2) CHECK (sono IS NULL OR sono >= 0),
      dormiu VARCHAR(10),
      acordou VARCHAR(10),
      agua INTEGER CHECK (agua IS NULL OR agua >= 0),
      diario TEXT NOT NULL DEFAULT '',
      nota TEXT NOT NULL DEFAULT '',
      manha TEXT NOT NULL DEFAULT '',
      tarde TEXT NOT NULL DEFAULT '',
      noite TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (usuario_id, data)
    )
  `],
  ["dias_abertos", `
    CREATE TABLE IF NOT EXISTS dias_abertos (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      data DATE NOT NULL,
      aberto_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (usuario_id, data)
    )
  `],
];

for (const [nome, comando] of comandos) {
  await sql.query(comando);
  console.log(`OK ${nome}`);
}

const tabelas = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
const nomesCriados = new Set(comandos.map(([nome]) => nome));
const verificacao = tabelas.filter((linha) => nomesCriados.has(linha.table_name));
console.log(`TOTAL_CONFIRMADO ${verificacao.length}`);
console.log(verificacao.map((linha) => linha.table_name).join("\n"));

const total = tabelas.length;
console.log(`TOTAL_PUBLICO ${total}`);
