import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

const comandos = [
  ["metas_economia", `
    CREATE TABLE IF NOT EXISTS metas_economia (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(160) NOT NULL,
      alvo NUMERIC(18, 2) NOT NULL CHECK (alvo >= 0),
      guardado NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (guardado >= 0),
      prazo DATE,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["pessoas", `
    CREATE TABLE IF NOT EXISTS pessoas (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["divisoes", `
    CREATE TABLE IF NOT EXISTS divisoes (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      descricao VARCHAR(240) NOT NULL,
      total NUMERIC(18, 2) NOT NULL CHECK (total >= 0),
      pagador_id VARCHAR(120) NOT NULL,
      data DATE NOT NULL,
      categoria_id VARCHAR(120),
      conta_id VARCHAR(120),
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, categoria_id) REFERENCES categorias(usuario_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (usuario_id, conta_id) REFERENCES contas(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["divisao_partes", `
    CREATE TABLE IF NOT EXISTS divisao_partes (
      usuario_id INTEGER NOT NULL,
      divisao_id VARCHAR(120) NOT NULL,
      pessoa_id VARCHAR(120) NOT NULL,
      valor NUMERIC(18, 2) NOT NULL CHECK (valor >= 0),
      PRIMARY KEY (usuario_id, divisao_id, pessoa_id),
      FOREIGN KEY (usuario_id, divisao_id) REFERENCES divisoes(usuario_id, id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id, pessoa_id) REFERENCES pessoas(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["acertos", `
    CREATE TABLE IF NOT EXISTS acertos (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      pessoa_id VARCHAR(120) NOT NULL,
      valor NUMERIC(18, 2) NOT NULL,
      data DATE NOT NULL,
      conta_id VARCHAR(120),
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, pessoa_id) REFERENCES pessoas(usuario_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (usuario_id, conta_id) REFERENCES contas(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["listas_compras", `
    CREATE TABLE IF NOT EXISTS listas_compras (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(160) NOT NULL,
      categoria_id VARCHAR(120),
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, categoria_id) REFERENCES categorias(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["itens_compras", `
    CREATE TABLE IF NOT EXISTS itens_compras (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      lista_id VARCHAR(120) NOT NULL,
      nome VARCHAR(160) NOT NULL,
      quantidade NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
      preco_estimado NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (preco_estimado >= 0),
      marcado BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, lista_id) REFERENCES listas_compras(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["historico_precos", `
    CREATE TABLE IF NOT EXISTS historico_precos (
      id BIGSERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      item_chave VARCHAR(160) NOT NULL,
      preco NUMERIC(18, 2) NOT NULL CHECK (preco >= 0),
      data DATE NOT NULL
    )
  `],
  ["regras_categoria", `
    CREATE TABLE IF NOT EXISTS regras_categoria (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      contem VARCHAR(160) NOT NULL,
      categoria_id VARCHAR(120) NOT NULL,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, categoria_id) REFERENCES categorias(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["cotacoes", `
    CREATE TABLE IF NOT EXISTS cotacoes (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      usd NUMERIC(18, 8) NOT NULL DEFAULT 0 CHECK (usd >= 0),
      eur NUMERIC(18, 8) NOT NULL DEFAULT 0 CHECK (eur >= 0),
      atualizada_em TIMESTAMPTZ,
      manual BOOLEAN NOT NULL DEFAULT FALSE
    )
  `],
];

for (const [nome, comando] of comandos) {
  await sql.query(comando);
  console.log(`OK ${nome}`);
}

await sql.query(`
  ALTER TABLE transacoes
    DROP CONSTRAINT IF EXISTS transacoes_usuario_id_divisao_id_fkey,
    DROP CONSTRAINT IF EXISTS fk_transacoes_divisao
`);
await sql.query(`
  ALTER TABLE transacoes
    ADD CONSTRAINT fk_transacoes_divisao
      FOREIGN KEY (usuario_id, divisao_id) REFERENCES divisoes(usuario_id, id) ON DELETE RESTRICT
`);

await sql`CREATE INDEX IF NOT EXISTS idx_divisoes_data ON divisoes (usuario_id, data)`;
await sql`CREATE INDEX IF NOT EXISTS idx_acertos_pessoa ON acertos (usuario_id, pessoa_id, data)`;
await sql`CREATE INDEX IF NOT EXISTS idx_itens_lista ON itens_compras (usuario_id, lista_id)`;
await sql`CREATE INDEX IF NOT EXISTS idx_historico_precos_item ON historico_precos (usuario_id, item_chave, data)`;
await sql`CREATE INDEX IF NOT EXISTS idx_regras_categoria_busca ON regras_categoria (usuario_id, contem)`;

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
