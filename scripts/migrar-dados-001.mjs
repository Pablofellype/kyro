import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");

const sql = neon(databaseUrl);

const comandos = [
  ["configuracoes_usuario", `
    CREATE TABLE IF NOT EXISTS configuracoes_usuario (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      dados JSONB NOT NULL DEFAULT '{}'::jsonb,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `],
  ["uso_busca_apps", `
    CREATE TABLE IF NOT EXISTS uso_busca_apps (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      app_id VARCHAR(160) NOT NULL,
      usos INTEGER NOT NULL DEFAULT 0 CHECK (usos >= 0),
      ultima_utilizacao TIMESTAMPTZ,
      PRIMARY KEY (usuario_id, app_id)
    )
  `],
  ["atividades_agentes", `
    CREATE TABLE IF NOT EXISTS atividades_agentes (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      agente_id VARCHAR(40) NOT NULL,
      texto TEXT NOT NULL,
      data TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["alertas_agentes", `
    CREATE TABLE IF NOT EXISTS alertas_agentes (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      agente_id VARCHAR(40) NOT NULL,
      texto TEXT NOT NULL,
      rota VARCHAR(60),
      servico VARCHAR(60),
      criado_em TIMESTAMPTZ NOT NULL,
      visto BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["conversas", `
    CREATE TABLE IF NOT EXISTS conversas (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      titulo VARCHAR(200) NOT NULL DEFAULT '',
      agente_id VARCHAR(40) NOT NULL,
      criada_em TIMESTAMPTZ NOT NULL,
      atualizada_em TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["mensagens", `
    CREATE TABLE IF NOT EXISTS mensagens (
      usuario_id INTEGER NOT NULL,
      id VARCHAR(120) NOT NULL,
      conversa_id VARCHAR(120) NOT NULL,
      autor VARCHAR(20) NOT NULL CHECK (autor IN ('usuario', 'agente')),
      agente_id VARCHAR(40) NOT NULL,
      texto TEXT NOT NULL,
      criada_em TIMESTAMPTZ NOT NULL,
      dados JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (usuario_id, id),
      FOREIGN KEY (usuario_id, conversa_id) REFERENCES conversas(usuario_id, id) ON DELETE CASCADE
    )
  `],
  ["memorias", `
    CREATE TABLE IF NOT EXISTS memorias (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      texto VARCHAR(300) NOT NULL,
      agente_id VARCHAR(40) NOT NULL,
      origem VARCHAR(20) NOT NULL CHECK (origem IN ('comando', 'manual')),
      data TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["conexoes", `
    CREATE TABLE IF NOT EXISTS conexoes (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      servico_id VARCHAR(60) NOT NULL,
      ligada BOOLEAN NOT NULL DEFAULT FALSE,
      chave_salva BOOLEAN NOT NULL DEFAULT FALSE,
      intervalo INTEGER NOT NULL DEFAULT 300 CHECK (intervalo > 0),
      status VARCHAR(30) NOT NULL,
      ultima_atualizacao TIMESTAMPTZ,
      resumo TEXT NOT NULL DEFAULT '',
      fixada_na_ilha BOOLEAN NOT NULL DEFAULT FALSE,
      falhas_vistas_em TIMESTAMPTZ,
      avisos VARCHAR(20),
      PRIMARY KEY (usuario_id, servico_id)
    )
  `],
  ["eventos_conexao", `
    CREATE TABLE IF NOT EXISTS eventos_conexao (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      servico_id VARCHAR(60) NOT NULL,
      texto TEXT NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('sucesso', 'falha', 'info')),
      data TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (usuario_id, id)
    )
  `],
  ["uso_ia", `
    CREATE TABLE IF NOT EXISTS uso_ia (
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      id VARCHAR(120) NOT NULL,
      data DATE NOT NULL,
      provedor VARCHAR(80) NOT NULL,
      modelo VARCHAR(160) NOT NULL,
      agente_id VARCHAR(40) NOT NULL,
      entrada BIGINT NOT NULL DEFAULT 0 CHECK (entrada >= 0),
      saida BIGINT NOT NULL DEFAULT 0 CHECK (saida >= 0),
      PRIMARY KEY (usuario_id, id)
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
