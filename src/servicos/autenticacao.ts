import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

const JANELA_TENTATIVAS_MIN = 15;
const LIMITE_TENTATIVAS = 5;
const EXPIRACAO_RECUPERACAO_HORAS = 1;
const EXPIRACAO_CONVITE_HORAS = 48;

export type PerfilUsuario = "dono" | "usuario";

export interface UsuarioAutenticadoServidor {
  id: number;
  email: string;
  nome: string;
  perfil: PerfilUsuario;
  roboAderencias: boolean;
}

export function getDb() {
  const databaseUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
  if (!databaseUrl) throw new Error("DATABASE_URL ou POSTGRES_URL não definida");
  return neon(databaseUrl);
}

function emailNormalizado(email: string): string {
  return email.toLowerCase().trim();
}

function tokenSeguro(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function basePublica(valor: string): string {
  const configurada = valor.trim().replace(/\/+$/, "");
  if (!configurada || !/^https?:\/\//i.test(configurada)) throw new Error("url_publica_nao_configurada");
  return configurada;
}

function linkDeAcesso(baseUrl: string, parametro: "recuperar" | "convite", token: string): string {
  const url = new URL(basePublica(baseUrl));
  url.searchParams.set(parametro, token);
  return url.toString();
}

async function enviarEmailDeAcesso(opcoes: { para: string; assunto: string; titulo: string; texto: string; link: string }) {
  const chave = process.env.RESEND_API_KEY?.trim();
  const remetente = process.env.RESEND_FROM_EMAIL?.trim();
  if (!chave || !remetente) throw new Error("email_nao_configurado");
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remetente,
      to: [opcoes.para],
      subject: opcoes.assunto,
      text: `${opcoes.titulo}\n\n${opcoes.texto}\n\n${opcoes.link}\n\nEste link expira automaticamente e só pode ser usado uma vez.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18181b;max-width:560px"><h1 style="font-size:24px">${opcoes.titulo}</h1><p>${opcoes.texto}</p><p><a href="${opcoes.link}" style="display:inline-block;background:#ef3340;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Continuar no Kyro</a></p><p style="font-size:12px;color:#71717a">Se você não solicitou isso, ignore este e-mail. O link expira automaticamente.</p></div>`,
    }),
  });
  if (!resposta.ok) throw new Error("email_nao_enviado");
}

function validarSenhaNova(senha: string): string | null {
  if (senha.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (senha.length > 200) return "A senha é muito longa.";
  return null;
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

function chaveDeTentativa(email: string, origem: string): string {
  return crypto.createHash("sha256").update(`${email}\n${origem}`).digest("hex");
}

async function bloqueioAtual(sql: ReturnType<typeof getDb>, chave: string): Promise<number> {
  try {
    const linhas = await sql`
      SELECT tentativas, bloqueado_ate, janela_inicio
      FROM tentativas_login
      WHERE chave = ${chave}
      LIMIT 1
    ` as Array<{ tentativas?: number; bloqueado_ate?: string | Date | null; janela_inicio?: string | Date | null }>;
    const linha = linhas[0];
    if (!linha) return 0;
    if (linha.bloqueado_ate && new Date(linha.bloqueado_ate).getTime() > Date.now()) return Math.ceil((new Date(linha.bloqueado_ate).getTime() - Date.now()) / 60000);
    if (linha.janela_inicio && Date.now() - new Date(linha.janela_inicio).getTime() > JANELA_TENTATIVAS_MIN * 60000) await sql`DELETE FROM tentativas_login WHERE chave = ${chave}`;
  } catch {
    // A proteção começa após a migração; login continua disponível antes dela.
  }
  return 0;
}

async function registrarFalhaLogin(sql: ReturnType<typeof getDb>, chave: string) {
  try {
    await sql`
      INSERT INTO tentativas_login (chave, tentativas, janela_inicio, bloqueado_ate, atualizado_em)
      VALUES (${chave}, 1, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT (chave) DO UPDATE SET
        tentativas = CASE
          WHEN tentativas_login.janela_inicio < CURRENT_TIMESTAMP - (${JANELA_TENTATIVAS_MIN} * INTERVAL '1 minute') THEN 1
          ELSE tentativas_login.tentativas + 1
        END,
        janela_inicio = CASE
          WHEN tentativas_login.janela_inicio < CURRENT_TIMESTAMP - (${JANELA_TENTATIVAS_MIN} * INTERVAL '1 minute') THEN CURRENT_TIMESTAMP
          ELSE tentativas_login.janela_inicio
        END,
        bloqueado_ate = CASE
          WHEN tentativas_login.janela_inicio < CURRENT_TIMESTAMP - (${JANELA_TENTATIVAS_MIN} * INTERVAL '1 minute') THEN NULL
          WHEN tentativas_login.tentativas + 1 >= ${LIMITE_TENTATIVAS} THEN CURRENT_TIMESTAMP + (${JANELA_TENTATIVAS_MIN} * INTERVAL '1 minute')
          ELSE tentativas_login.bloqueado_ate
        END,
        atualizado_em = CURRENT_TIMESTAMP
    `;
  } catch {
    return;
  }
}

async function limparTentativasLogin(sql: ReturnType<typeof getDb>, chave: string) {
  try {
    await sql`DELETE FROM tentativas_login WHERE chave = ${chave}`;
  } catch {
    return;
  }
}

async function criarSessao(sql: ReturnType<typeof getDb>, usuario: { id: number; email: string; nome: string; perfil?: string | null; robo_aderencias?: boolean | null }) {
  const token = tokenSeguro();
  const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessoes (token, usuario_id, expira_em)
    VALUES (${token}, ${usuario.id}, ${expiraEm.toISOString()});
  `;
  return {
    sucesso: true as const,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      perfil: usuario.perfil === "dono" ? "dono" as const : "usuario" as const,
      roboAderencias: usuario.perfil === "dono" || usuario.robo_aderencias === true,
    },
    token,
  };
}

export function urlPublicaDoAmbiente(): string {
  const configurada = process.env.KYRO_PUBLIC_URL?.trim();
  if (configurada) return configurada;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : "";
}

export async function solicitarRedefinicaoSenha(emailRecebido: string, urlBase: string) {
  const sql = getDb();
  const email = emailNormalizado(emailRecebido);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const usuarios = await sql`
    SELECT id, email, nome
    FROM usuarios
    WHERE email = ${email} AND ativo = TRUE
    LIMIT 1
  `;
  if (usuarios.length === 0) return;
  const token = tokenSeguro();
  const tokenHash = hashToken(token);
  await sql`UPDATE tokens_acesso SET usado_em = CURRENT_TIMESTAMP WHERE email = ${email} AND tipo = 'recuperacao' AND usado_em IS NULL`;
  await sql`
    INSERT INTO tokens_acesso (token_hash, tipo, usuario_id, email, nome, expira_em)
    VALUES (${tokenHash}, 'recuperacao', ${usuarios[0].id}, ${email}, ${usuarios[0].nome ?? ""}, CURRENT_TIMESTAMP + (${EXPIRACAO_RECUPERACAO_HORAS} * INTERVAL '1 hour'))
  `;
  try {
    await enviarEmailDeAcesso({
      para: email,
      assunto: "Redefina sua senha do Kyro",
      titulo: "Redefinição de senha",
      texto: "Recebemos um pedido para criar uma nova senha para sua conta do Kyro.",
      link: linkDeAcesso(urlBase, "recuperar", token),
    });
  } catch (erro) {
    await sql`DELETE FROM tokens_acesso WHERE token_hash = ${tokenHash}`;
    throw erro;
  }
}

export async function criarConviteUsuario(dono: UsuarioAutenticadoServidor, emailRecebido: string, nomeRecebido: string, urlBase: string) {
  if (dono.perfil !== "dono") throw new Error("permissao_negada");
  const sql = getDb();
  const email = emailNormalizado(emailRecebido);
  const nome = nomeRecebido.trim().slice(0, 160);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("email_invalido");
  if (!nome) throw new Error("nome_obrigatorio");
  const existentes = await sql`SELECT id FROM usuarios WHERE email = ${email} LIMIT 1`;
  if (existentes.length > 0) throw new Error("usuario_ja_cadastrado");
  const token = tokenSeguro();
  const tokenHash = hashToken(token);
  await sql`UPDATE tokens_acesso SET usado_em = CURRENT_TIMESTAMP WHERE email = ${email} AND tipo = 'convite' AND usado_em IS NULL`;
  await sql`
    INSERT INTO tokens_acesso (token_hash, tipo, email, nome, expira_em)
    VALUES (${tokenHash}, 'convite', ${email}, ${nome}, CURRENT_TIMESTAMP + (${EXPIRACAO_CONVITE_HORAS} * INTERVAL '1 hour'))
  `;
  try {
    await enviarEmailDeAcesso({
      para: email,
      assunto: "Seu convite para o Kyro",
      titulo: "Você foi convidado para o Kyro",
      texto: `Olá${nome ? `, ${nome}` : ""}. Defina sua senha para ativar seu acesso ao sistema.`,
      link: linkDeAcesso(urlBase, "convite", token),
    });
  } catch (erro) {
    await sql`DELETE FROM tokens_acesso WHERE token_hash = ${tokenHash}`;
    throw erro;
  }
}

export async function redefinirSenhaComToken(tokenRecebido: string, senha: string) {
  const erroSenha = validarSenhaNova(senha);
  if (erroSenha) throw new Error(erroSenha);
  if (!/^[a-f0-9]{64}$/i.test(tokenRecebido)) throw new Error("token_invalido");
  const sql = getDb();
  const tokenHash = hashToken(tokenRecebido);
  const tokens = await sql`
    SELECT token_hash, tipo, usuario_id, email, nome, expira_em, usado_em
    FROM tokens_acesso
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;
  const convite = tokens[0];
  if (!convite || convite.usado_em || new Date(convite.expira_em).getTime() <= Date.now()) throw new Error("token_expirado");
  const hash = gerarHash(senha);
  let usuario: { id: number; email: string; nome: string; perfil?: string | null };
  if (convite.tipo === "convite") {
    const existentes = await sql`SELECT id FROM usuarios WHERE email = ${convite.email} LIMIT 1`;
    if (existentes.length > 0) throw new Error("usuario_ja_cadastrado");
    const criados = await sql`
      INSERT INTO usuarios (email, nome, senha_hash, ativo, perfil)
      VALUES (${convite.email}, ${convite.nome}, ${hash}, TRUE, 'usuario')
      RETURNING id, email, nome, perfil
    `;
    usuario = criados[0] as typeof usuario;
  } else {
    if (!convite.usuario_id) throw new Error("token_invalido");
    const atualizados = await sql`
      UPDATE usuarios
      SET senha_hash = ${hash}, ativo = TRUE
      WHERE id = ${convite.usuario_id} AND email = ${convite.email}
      RETURNING id, email, nome, perfil
    `;
    if (atualizados.length === 0) throw new Error("usuario_invalido");
    usuario = atualizados[0] as typeof usuario;
  }
  await sql`UPDATE tokens_acesso SET usado_em = CURRENT_TIMESTAMP, usuario_id = ${usuario.id} WHERE token_hash = ${tokenHash}`;
  await sql`DELETE FROM sessoes WHERE usuario_id = ${usuario.id}`;
  return criarSessao(sql, usuario as { id: number; email: string; nome: string; perfil?: string | null });
}

export async function listarUsuarios(dono: UsuarioAutenticadoServidor) {
  if (dono.perfil !== "dono") throw new Error("permissao_negada");
  const sql = getDb();
  return sql`
    SELECT id, email, nome, ativo, perfil, robo_aderencias
    FROM usuarios
    ORDER BY CASE WHEN perfil = 'dono' THEN 0 ELSE 1 END, nome, email
  `;
}

export async function alterarAtivoUsuario(dono: UsuarioAutenticadoServidor, usuarioId: number, ativo: boolean) {
  if (dono.perfil !== "dono") throw new Error("permissao_negada");
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0 || usuarioId === dono.id) throw new Error("dono_nao_pode_ser_alterado");
  const sql = getDb();
  const resultado = await sql`
    UPDATE usuarios
    SET ativo = ${ativo}
    WHERE id = ${usuarioId} AND perfil <> 'dono'
    RETURNING id, email, nome, ativo, perfil, robo_aderencias
  `;
  if (resultado.length === 0) throw new Error("usuario_nao_encontrado");
  if (!ativo) await sql`DELETE FROM sessoes WHERE usuario_id = ${usuarioId}`;
  return resultado[0];
}

export async function alterarPermissaoAderencias(dono: UsuarioAutenticadoServidor, usuarioId: number, permitido: boolean) {
  if (dono.perfil !== "dono") throw new Error("permissao_negada");
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0 || usuarioId === dono.id) throw new Error("dono_nao_pode_ser_alterado");
  const sql = getDb();
  const resultado = await sql`
    UPDATE usuarios
    SET robo_aderencias = ${permitido}
    WHERE id = ${usuarioId} AND perfil <> 'dono'
    RETURNING id, email, nome, ativo, perfil, robo_aderencias
  `;
  if (resultado.length === 0) throw new Error("usuario_nao_encontrado");
  return resultado[0];
}

export async function loginUsuario(emailRecebido: string, senhaRecebida: string, origem = "desconhecida") {
  const sql = getDb();
  const emailNorm = emailNormalizado(emailRecebido);
  const chave = chaveDeTentativa(emailNorm, origem);
  const minutos = await bloqueioAtual(sql, chave);
  if (minutos > 0) return { sucesso: false, erro: `Muitas tentativas de acesso. Tente novamente em ${minutos} minuto${minutos === 1 ? "" : "s"}.` };

  const usuarios = await sql`
    SELECT id, email, nome, senha_hash, ativo, perfil, robo_aderencias
    FROM usuarios 
    WHERE email = ${emailNorm}
    LIMIT 1;
  `;

  if (usuarios.length === 0) {
    await registrarFalhaLogin(sql, chave);
    return { sucesso: false, erro: "E-mail não autorizado para acesso ao sistema." };
  }

  const usuario = usuarios[0];

  if (!usuario.ativo) {
    await registrarFalhaLogin(sql, chave);
    return { sucesso: false, erro: "Este usuário está temporariamente desativado." };
  }

  const senhaCorreta = verificarHash(senhaRecebida, usuario.senha_hash);
  if (!senhaCorreta) {
    await registrarFalhaLogin(sql, chave);
    return { sucesso: false, erro: "Senha incorreta." };
  }

  await limparTentativasLogin(sql, chave);
  await sql`DELETE FROM sessoes WHERE expira_em <= CURRENT_TIMESTAMP`;
  return criarSessao(sql, usuario as { id: number; email: string; nome: string; perfil?: string | null });
}

export async function validarSessao(token: string) {
  if (!token || typeof token !== "string") return null;
  const sql = getDb();

  const sessoes = await sql`
    SELECT s.token, s.expira_em, u.id, u.email, u.nome, u.ativo, u.perfil, u.robo_aderencias
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
    perfil: s.perfil === "dono" ? "dono" as const : "usuario" as const,
    roboAderencias: s.perfil === "dono" || s.robo_aderencias === true,
  };
}

export async function logoutSessao(token: string) {
  if (!token) return;
  const sql = getDb();
  await sql`DELETE FROM sessoes WHERE token = ${token};`;
}
