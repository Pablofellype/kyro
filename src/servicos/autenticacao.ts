import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_BfLEYQUZ4r0G@ep-spring-sun-b672866p-pooler.c-2.sa-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

export function getDb() {
  return neon(DATABASE_URL);
}

export function gerarHash(senha: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verificarHash(senha: string, hashSalvo: string): boolean {
  try {
    if (!hashSalvo.startsWith("scrypt:")) return false;
    const [, salt, hash] = hashSalvo.split(":");
    if (!salt || !hash) return false;
    const hashTentativa = crypto.scryptSync(senha, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(hashTentativa, "hex"));
  } catch {
    return false;
  }
}

export async function loginUsuario(emailRecebido: string, senhaRecebida: string) {
  const sql = getDb();
  const emailNorm = emailRecebido.toLowerCase().trim();

  const usuarios = await sql`
    SELECT id, email, nome, senha_hash, ativo 
    FROM usuarios 
    WHERE email = ${emailNorm}
    LIMIT 1;
  `;

  if (usuarios.length === 0) {
    return { sucesso: false, erro: "E-mail não autorizado para acesso ao sistema." };
  }

  const usuario = usuarios[0];

  if (!usuario.ativo) {
    return { sucesso: false, erro: "Este usuário está temporariamente desativado." };
  }

  const senhaCorreta = verificarHash(senhaRecebida, usuario.senha_hash);
  if (!senhaCorreta) {
    return { sucesso: false, erro: "Senha incorreta." };
  }

  // Gera token de sessao com validade de 30 dias
  const token = crypto.randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO sessoes (token, usuario_id, expira_em)
    VALUES (${token}, ${usuario.id}, ${expiraEm.toISOString()});
  `;

  return {
    sucesso: true,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
    },
    token,
  };
}

export async function validarSessao(token: string) {
  if (!token || typeof token !== "string") return null;
  const sql = getDb();

  const sessoes = await sql`
    SELECT s.token, s.expira_em, u.id, u.email, u.nome, u.ativo
    FROM sessoes s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ${token} AND s.expira_em > CURRENT_TIMESTAMP AND u.ativo = TRUE
    LIMIT 1;
  `;

  if (sessoes.length === 0) return null;
  const s = sessoes[0];

  return {
    id: s.id,
    email: s.email,
    nome: s.nome,
  };
}

export async function logoutSessao(token: string) {
  if (!token) return;
  const sql = getDb();
  await sql`DELETE FROM sessoes WHERE token = ${token};`;
}
