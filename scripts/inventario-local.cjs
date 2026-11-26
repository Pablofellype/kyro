const { existsSync, readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { parseEnv } = require("node:util");
const { resolve } = require("node:path");

if (!process.argv[2]) throw new Error("Informe a pasta do Inventário como argumento.");
const pastaInventario = resolve(process.argv[2]);

const arquivoEnvKyro = resolve(__dirname, "../.env.local");
const token = parseEnv(readFileSync(arquivoEnvKyro, "utf8")).INVENTARIO_INTEGRACAO_TOKEN?.trim();
if (!token || token.length < 32) throw new Error("Configure a credencial de integração no .env.local do Kyro.");

process.loadEnvFile(resolve(pastaInventario, ".env.local"));
const arquivoVercel = resolve(pastaInventario, ".vercel/.env.development.local");
if (existsSync(arquivoVercel)) {
  const vercel = parseEnv(readFileSync(arquivoVercel, "utf8"));
  for (const chave of ["BLOB_STORE_ID", "VERCEL_OIDC_TOKEN"]) {
    if (!process.env[chave] && vercel[chave]) process.env[chave] = vercel[chave];
  }
}
process.chdir(pastaInventario);
const { banco } = require(resolve(pastaInventario, "server/cloud-db.js"));
const { criarHandler } = require(resolve(pastaInventario, "server/integracao-solicitacoes.js"));
const pool = banco();

async function query(sql, parametros) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN READ ONLY");
    return await cliente.query(sql, parametros);
  } finally {
    try { await cliente.query("ROLLBACK"); }
    finally { cliente.release(); }
  }
}

const handler = criarHandler({
  obterBanco: () => ({ query }),
  env: { INVENTARIO_INTEGRACAO_TOKEN: token },
  ...(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? {} : { obterFoto: async () => null }),
});

createServer((req, res) => {
  if (req.method === "GET" && req.url?.split("?", 1)[0] === "/api/integracoes/solicitacoes") {
    void handler(req, res);
  } else {
    res.writeHead(404).end();
  }
}).listen(33318, "127.0.0.1", () => console.log("Inventário local somente leitura na porta 33318"));
