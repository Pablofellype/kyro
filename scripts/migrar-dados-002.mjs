import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

const comandos = [
  ["analises_escritorio", `
    CREATE TABLE IF NOT EXISTS analises_escritorio (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(160) NOT NULL,
      sessao VARCHAR(120) NOT NULL,
      projeto VARCHAR(80) NOT NULL,
      nome VARCHAR(80) NOT NULL,
      ferramenta VARCHAR(40) NOT NULL,
      em BIGINT NOT NULL,
      estado VARCHAR(20),
      acao BOOLEAN NOT NULL DEFAULT FALSE,
      falha BOOLEAN NOT NULL DEFAULT FALSE,
      pedido BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["historico_codigo", `
    CREATE TABLE IF NOT EXISTS historico_codigo (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      sessoes JSONB NOT NULL DEFAULT '{}'::jsonb,
      ultimo_evento BIGINT NOT NULL DEFAULT 0,
      esconder_projetos BOOLEAN NOT NULL DEFAULT FALSE,
      ultimo_resumo_visto VARCHAR(120),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `],
  ["conquistas_alcancadas", `
    CREATE TABLE IF NOT EXISTS conquistas_alcancadas (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      codigo VARCHAR(100) NOT NULL,
      nivel INTEGER NOT NULL CHECK (nivel >= 0),
      data TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (usuario_id, codigo)
    )
  `],
  ["materiais", `
    CREATE TABLE IF NOT EXISTS materiais (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(160) NOT NULL,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["materiais_variacoes", `
    CREATE TABLE IF NOT EXISTS materiais_variacoes (
      usuario_id INTEGER NOT NULL,
      material_id VARCHAR(120) NOT NULL,
      ordem INTEGER NOT NULL CHECK (ordem >= 0),
      tamanho VARCHAR(80) NOT NULL DEFAULT '',
      codigo VARCHAR(120) NOT NULL,
      PRIMARY KEY (usuario_id, material_id, ordem),
      FOREIGN KEY (usuario_id, material_id) REFERENCES materiais(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["areas_estudo", `
    CREATE TABLE IF NOT EXISTS areas_estudo (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      tipo VARCHAR(40) NOT NULL,
      cor VARCHAR(20) NOT NULL,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["materias", `
    CREATE TABLE IF NOT EXISTS materias (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      area_id VARCHAR(120) NOT NULL,
      nome VARCHAR(160) NOT NULL,
      semestre VARCHAR(80),
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, area_id) REFERENCES areas_estudo(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["colunas_materia", `
    CREATE TABLE IF NOT EXISTS colunas_materia (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      materia_id VARCHAR(120) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      conclui BOOLEAN NOT NULL DEFAULT FALSE,
      ordem INTEGER NOT NULL DEFAULT 0 CHECK (ordem >= 0),
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, materia_id) REFERENCES materias(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["paginas_estudo", `
    CREATE TABLE IF NOT EXISTS paginas_estudo (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      materia_id VARCHAR(120) NOT NULL,
      pai_id VARCHAR(120),
      titulo VARCHAR(240) NOT NULL DEFAULT '',
      conteudo TEXT NOT NULL DEFAULT '',
      atualizada_em TIMESTAMPTZ NOT NULL,
      estudada_em DATE,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, materia_id) REFERENCES materias(usuario_id, id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id, pai_id) REFERENCES paginas_estudo(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["sessoes_pomodoro", `
    CREATE TABLE IF NOT EXISTS sessoes_pomodoro (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      etapa VARCHAR(30) NOT NULL CHECK (etapa IN ('foco', 'pausa_curta', 'pausa_longa')),
      inicio TIMESTAMPTZ NOT NULL,
      minutos NUMERIC(10, 2) NOT NULL CHECK (minutos >= 0),
      materia_id VARCHAR(120),
      tarefa_id VARCHAR(120),
      situacao VARCHAR(20) NOT NULL CHECK (situacao IN ('concluida', 'interrompida')),
      PRIMARY KEY (usuario_id, id)
    )
  `],
];

for (const [nome, comando] of comandos) {
  await sql.query(comando);
  console.log(`OK ${nome}`);
}

await sql`CREATE INDEX IF NOT EXISTS idx_analises_escritorio_usuario_em ON analises_escritorio (usuario_id, em)`;
await sql`CREATE INDEX IF NOT EXISTS idx_materias_area ON materias (usuario_id, area_id)`;
await sql`CREATE INDEX IF NOT EXISTS idx_paginas_materia ON paginas_estudo (usuario_id, materia_id)`;
await sql`CREATE INDEX IF NOT EXISTS idx_pomodoro_materia ON sessoes_pomodoro (usuario_id, materia_id)`;

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
