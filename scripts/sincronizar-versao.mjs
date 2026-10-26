import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planejarVersao, sincronizarVersao, lerVersoes, validarVersoes } from "./versao-release.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const versao = process.argv[2];

if (!versao) throw new Error("Informe a versão. Exemplo: pnpm versao:sincronizar 0.2.12");

const plano = planejarVersao(raiz, versao);
sincronizarVersao(plano);
validarVersoes(lerVersoes(raiz), versao);
console.log(`Versão ${versao} sincronizada nos arquivos do projeto. Nenhum build foi iniciado.`);
