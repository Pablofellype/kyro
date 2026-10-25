import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

const comandos = [
  ["datas_importantes", `
    CREATE TABLE IF NOT EXISTS datas_importantes (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      materia_id VARCHAR(120) NOT NULL,
      titulo VARCHAR(160) NOT NULL,
      tipo VARCHAR(30) NOT NULL,
      data DATE NOT NULL,
      concluida BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, materia_id) REFERENCES materias(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["cartoes_revisao", `
    CREATE TABLE IF NOT EXISTS cartoes_revisao (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      materia_id VARCHAR(120) NOT NULL,
      frente VARCHAR(500) NOT NULL,
      verso VARCHAR(2000) NOT NULL,
      vencimento TIMESTAMPTZ NOT NULL,
      estabilidade DOUBLE PRECISION NOT NULL,
      dificuldade DOUBLE PRECISION NOT NULL,
      dias_decorridos INTEGER NOT NULL DEFAULT 0,
      dias_agendados INTEGER NOT NULL DEFAULT 0,
      repeticoes INTEGER NOT NULL DEFAULT 0,
      lapsos INTEGER NOT NULL DEFAULT 0,
      estado INTEGER NOT NULL,
      ultima_revisao TIMESTAMPTZ,
      aprendizado INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, materia_id) REFERENCES materias(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["revisoes_conteudo", `
    CREATE TABLE IF NOT EXISTS revisoes_conteudo (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      pagina_id VARCHAR(120) NOT NULL,
      data DATE NOT NULL,
      feita BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, pagina_id) REFERENCES paginas_estudo(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["links_salvos", `
    CREATE TABLE IF NOT EXISTS links_salvos (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      url TEXT NOT NULL,
      titulo VARCHAR(240) NOT NULL DEFAULT '',
      nota TEXT NOT NULL DEFAULT '',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      materia_id VARCHAR(120),
      estado VARCHAR(30) NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, materia_id) REFERENCES materias(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["registros_revisao", `
    CREATE TABLE IF NOT EXISTS registros_revisao (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      data DATE NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
      PRIMARY KEY (usuario_id, data)
    )
  `],
  ["contas", `
    CREATE TABLE IF NOT EXISTS contas (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      tipo VARCHAR(30) NOT NULL,
      moeda VARCHAR(3) NOT NULL DEFAULT 'BRL',
      saldo_inicial NUMERIC(18, 2) NOT NULL DEFAULT 0,
      cor VARCHAR(20) NOT NULL,
      fechamento_dia INTEGER,
      vencimento_dia INTEGER,
      limite NUMERIC(18, 2),
      arquivada BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["categorias", `
    CREATE TABLE IF NOT EXISTS categorias (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      cor VARCHAR(20) NOT NULL,
      orcamento NUMERIC(18, 2) NOT NULL DEFAULT 0,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('despesa', 'receita')),
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["transacoes", `
    CREATE TABLE IF NOT EXISTS transacoes (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('despesa', 'receita', 'transferencia')),
      valor NUMERIC(18, 2) NOT NULL,
      descricao VARCHAR(240) NOT NULL,
      categoria_id VARCHAR(120),
      conta_id VARCHAR(120) NOT NULL,
      conta_destino_id VARCHAR(120),
      valor_destino NUMERIC(18, 2),
      data DATE NOT NULL,
      recorrente_id VARCHAR(120),
      grupo_parcelas_id VARCHAR(120),
      parcela_numero INTEGER,
      parcela_total INTEGER,
      divisao_id VARCHAR(120),
      ajuste BOOLEAN NOT NULL DEFAULT FALSE,
      criada_em TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, categoria_id) REFERENCES categorias(usuario_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (usuario_id, conta_id) REFERENCES contas(usuario_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (usuario_id, conta_destino_id) REFERENCES contas(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["recorrentes", `
    CREATE TABLE IF NOT EXISTS recorrentes (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      descricao VARCHAR(240) NOT NULL,
      valor NUMERIC(18, 2) NOT NULL,
      categoria_id VARCHAR(120),
      conta_id VARCHAR(120) NOT NULL,
      dia INTEGER NOT NULL,
      frequencia VARCHAR(20) NOT NULL CHECK (frequencia IN ('mensal', 'anual')),
      mes_anual INTEGER,
      ativa BOOLEAN NOT NULL DEFAULT TRUE,
      gerado_ate DATE,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, categoria_id) REFERENCES categorias(usuario_id, id) ON DELETE RESTRICT,
      FOREIGN KEY (usuario_id, conta_id) REFERENCES contas(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["assinaturas_ignoradas", `
    CREATE TABLE IF NOT EXISTS assinaturas_ignoradas (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      chave VARCHAR(240) NOT NULL,
      PRIMARY KEY (usuario_id, chave)
    )
  `],
];

for (const [nome, comando] of comandos) {
  await sql.query(comando);
  console.log(`OK ${nome}`);
}

await sql.query(`ALTER TABLE links_salvos DROP CONSTRAINT IF EXISTS links_salvos_usuario_id_materia_id_fkey, DROP CONSTRAINT IF EXISTS fk_links_salvos_materia`);
await sql.query(`ALTER TABLE links_salvos ADD CONSTRAINT fk_links_salvos_materia FOREIGN KEY (usuario_id, materia_id) REFERENCES materias(usuario_id, id) ON DELETE RESTRICT`);
await sql.query(`ALTER TABLE transacoes DROP CONSTRAINT IF EXISTS transacoes_usuario_id_categoria_id_fkey, DROP CONSTRAINT IF EXISTS fk_transacoes_categoria`);
await sql.query(`ALTER TABLE transacoes ADD CONSTRAINT fk_transacoes_categoria FOREIGN KEY (usuario_id, categoria_id) REFERENCES categorias(usuario_id, id) ON DELETE RESTRICT`);
await sql.query(`ALTER TABLE recorrentes DROP CONSTRAINT IF EXISTS recorrentes_usuario_id_categoria_id_fkey, DROP CONSTRAINT IF EXISTS fk_recorrentes_categoria`);
await sql.query(`ALTER TABLE recorrentes ADD CONSTRAINT fk_recorrentes_categoria FOREIGN KEY (usuario_id, categoria_id) REFERENCES categorias(usuario_id, id) ON DELETE RESTRICT`);

await sql`CREATE INDEX IF NOT EXISTS idx_datas_materia ON datas_importantes (usuario_id, materia_id, data)`;
await sql`CREATE INDEX IF NOT EXISTS idx_cartoes_vencimento ON cartoes_revisao (usuario_id, vencimento)`;
await sql`CREATE INDEX IF NOT EXISTS idx_revisoes_pagina ON revisoes_conteudo (usuario_id, pagina_id, data)`;
await sql`CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes (usuario_id, data)`;
await sql`CREATE INDEX IF NOT EXISTS idx_transacoes_conta ON transacoes (usuario_id, conta_id)`;
await sql`CREATE INDEX IF NOT EXISTS idx_recorrentes_ativos ON recorrentes (usuario_id, ativa, dia)`;

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
