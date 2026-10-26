import fs from "node:fs";

const arquivoEnv = new URL("../.env.local", import.meta.url);
if (fs.existsSync(arquivoEnv)) {
  for (const linha of fs.readFileSync(arquivoEnv, "utf8").split(/\r?\n/)) {
    const entrada = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(linha);
    if (!entrada || process.env[entrada[1]]) continue;
    process.env[entrada[1]] = entrada[2].replace(/^['\"]|['\"]$/g, "");
  }
}

const migracoes = [
  "migrar-dados-001.mjs",
  "migrar-dados-002.mjs",
  "migrar-dados-003.mjs",
  "migrar-dados-004.mjs",
  "migrar-dados-005.mjs",
  "migrar-dados-006.mjs",
  "migrar-dados-007.mjs",
  "migrar-dados-008.mjs",
  "migrar-dados-009.mjs",
  "migrar-dados-010.mjs",
  "migrar-dados-011.mjs",
];

for (const nome of migracoes) {
  console.log(`Executando ${nome}...`);
  await import(`./${nome}`);
}

console.log("Banco do Kyro atualizado.");
