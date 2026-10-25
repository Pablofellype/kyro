import { getDb } from "./autenticacao.js";

const CHAVE_VALIDA = /^niko:[a-z0-9_-]{1,60}$/i;
const TAMANHO_MAXIMO = 20_000_000;

export type ItensDadosUsuario = Record<string, string | null>;

function validarChave(chave: string) {
  if (!CHAVE_VALIDA.test(chave)) throw new Error("chave_invalida");
}

export function validarItensDadosUsuario(valor: unknown): ItensDadosUsuario {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("itens_invalidos");
  const itens: ItensDadosUsuario = {};
  for (const [chave, dado] of Object.entries(valor)) {
    validarChave(chave);
    if (dado !== null && typeof dado !== "string") throw new Error("valor_invalido");
    if (typeof dado === "string" && dado.length > TAMANHO_MAXIMO) throw new Error("valor_invalido");
    itens[chave] = dado;
  }
  return itens;
}

export async function lerDadosUsuario(usuarioId: number): Promise<Record<string, string>> {
  const sql = getDb();
  const linhas = await sql`
    SELECT chave, valor
    FROM dados_usuario
    WHERE usuario_id = ${usuarioId}
    ORDER BY chave
  `;
  return Object.fromEntries(linhas.filter((linha) => typeof linha.valor === "string").map((linha) => [linha.chave, linha.valor]));
}

export async function gravarDadosUsuario(usuarioId: number, bruto: unknown): Promise<void> {
  const itens = validarItensDadosUsuario(bruto);
  const sql = getDb();
  for (const [chave, valor] of Object.entries(itens)) {
    if (valor === null) {
      await sql`DELETE FROM dados_usuario WHERE usuario_id = ${usuarioId} AND chave = ${chave}`;
    } else {
      await sql`
        INSERT INTO dados_usuario (usuario_id, chave, valor, atualizado_em)
        VALUES (${usuarioId}, ${chave}, ${valor}, CURRENT_TIMESTAMP)
        ON CONFLICT (usuario_id, chave)
        DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = CURRENT_TIMESTAMP
      `;
    }
  }
}

export async function zerarDadosUsuario(usuarioId: number): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM dados_usuario WHERE usuario_id = ${usuarioId}`;
}
