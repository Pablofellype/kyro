import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

const comandos = [
  ["pilares", `
    CREATE TABLE IF NOT EXISTS pilares (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      nota NUMERIC(5, 2) NOT NULL DEFAULT 5 CHECK (nota >= 0 AND nota <= 10),
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["metas", `
    CREATE TABLE IF NOT EXISTS metas (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(160) NOT NULL,
      pilar_id VARCHAR(120) NOT NULL,
      tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('habito', 'estudo', 'financeira', 'tarefas', 'manual')),
      alvo NUMERIC(18, 2) NOT NULL DEFAULT 0,
      atual NUMERIC(18, 2) NOT NULL DEFAULT 0,
      vinculo_id VARCHAR(120),
      periodo VARCHAR(20) NOT NULL CHECK (periodo IN ('trimestre', 'ano')),
      prazo DATE,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, pilar_id) REFERENCES pilares(usuario_id, id) ON DELETE RESTRICT
    )
  `],
  ["historico_metas", `
    CREATE TABLE IF NOT EXISTS historico_metas (
      usuario_id INTEGER NOT NULL,
      meta_id VARCHAR(120) NOT NULL,
      data DATE NOT NULL,
      valor NUMERIC(18, 2) NOT NULL,
      PRIMARY KEY (usuario_id, meta_id, data),
      FOREIGN KEY (usuario_id, meta_id) REFERENCES metas(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["visao", `
    CREATE TABLE IF NOT EXISTS visao (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      estado VARCHAR(30) NOT NULL CHECK (estado IN ('em_andamento', 'planejada', 'concluida')),
      prazo DATE,
      imagem TEXT,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["eventos", `
    CREATE TABLE IF NOT EXISTS eventos (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      data DATE NOT NULL,
      hora VARCHAR(5),
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('evento', 'lembrete')),
      repeticao VARCHAR(20) NOT NULL CHECK (repeticao IN ('nenhuma', 'diaria', 'semanal', 'mensal')),
      ultimo_disparo TIMESTAMPTZ,
      meta_id VARCHAR(120),
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["ocorrencias_eventos", `
    CREATE TABLE IF NOT EXISTS ocorrencias_eventos (
      usuario_id INTEGER NOT NULL,
      evento_id VARCHAR(120) NOT NULL,
      data DATE NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('feito', 'excecao')),
      PRIMARY KEY (usuario_id, evento_id, data, tipo),
      FOREIGN KEY (usuario_id, evento_id) REFERENCES eventos(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["tarefas", `
    CREATE TABLE IF NOT EXISTS tarefas (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      titulo VARCHAR(240) NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL CHECK (status IN ('a_fazer', 'em_andamento', 'concluida', 'reagendada', 'cancelada', 'em_aguardo')),
      data DATE,
      hora VARCHAR(5),
      materia_id VARCHAR(120),
      coluna_id VARCHAR(120),
      meta_id VARCHAR(120),
      prioridade VARCHAR(20) NOT NULL CHECK (prioridade IN ('baixa', 'media', 'alta')),
      estimativa_pomodoros INTEGER CHECK (estimativa_pomodoros IS NULL OR estimativa_pomodoros >= 0),
      criada_em TIMESTAMPTZ NOT NULL,
      concluida_em TIMESTAMPTZ,
      ordem BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["itens_checklist", `
    CREATE TABLE IF NOT EXISTS itens_checklist (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      tarefa_id VARCHAR(120) NOT NULL,
      texto VARCHAR(300) NOT NULL,
      feito BOOLEAN NOT NULL DEFAULT FALSE,
      ordem INTEGER NOT NULL DEFAULT 0 CHECK (ordem >= 0),
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, tarefa_id) REFERENCES tarefas(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["habitos", `
    CREATE TABLE IF NOT EXISTS habitos (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      nome VARCHAR(160) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('sim_nao', 'quantidade')),
      meta NUMERIC(18, 3) NOT NULL DEFAULT 1 CHECK (meta >= 0),
      unidade VARCHAR(60) NOT NULL DEFAULT '',
      arquivado BOOLEAN NOT NULL DEFAULT FALSE,
      hora VARCHAR(5),
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["registros_habitos", `
    CREATE TABLE IF NOT EXISTS registros_habitos (
      usuario_id INTEGER NOT NULL,
      habito_id VARCHAR(120) NOT NULL,
      data DATE NOT NULL,
      valor NUMERIC(18, 3) NOT NULL DEFAULT 0 CHECK (valor >= 0),
      PRIMARY KEY (usuario_id, habito_id, data),
      FOREIGN KEY (usuario_id, habito_id) REFERENCES habitos(usuario_id, id) ON DELETE CASCADE
    )
  `],
];

for (const [nome, comando] of comandos) {
  await sql.query(comando);
  console.log(`OK ${nome}`);
}

await sql`CREATE INDEX IF NOT EXISTS idx_metas_pilar ON metas (usuario_id, pilar_id)`;
await sql`CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos (usuario_id, data)`;
await sql`CREATE INDEX IF NOT EXISTS idx_tarefas_data_status ON tarefas (usuario_id, data, status)`;
await sql`CREATE INDEX IF NOT EXISTS idx_habitos_registros_data ON registros_habitos (usuario_id, data)`;

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
