import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { plataforma } from "./plataforma/index.ts";

const AUTORIZACAO = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0";
const ESCOPO = ["openid", "profile", "offline_access", "User.Read", "Mail.Read", "Calendars.Read"];

export interface CredencialOutlook {
  clienteId: string;
  refresh: string;
  email?: string;
}

function base64url(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function validarClienteId(clienteId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clienteId);
}

export function lerCredencialOutlook(texto: string): CredencialOutlook {
  const c = JSON.parse(texto) as CredencialOutlook;
  if (!validarClienteId(c.clienteId) || !c.refresh) throw new Error("credencial_invalida");
  return c;
}

export async function autorizarOutlook(clienteId: string): Promise<CredencialOutlook> {
  if (!validarClienteId(clienteId)) throw new Error("cliente_id_invalido");
  const verificador = base64url(randomBytes(48));
  const desafio = base64url(createHash("sha256").update(verificador).digest());
  const estado = base64url(randomBytes(16));
  const { codigo, redirecionamento } = await new Promise<{ codigo: string; redirecionamento: string }>((resolver, rejeitar) => {
    const servidor = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const codigoRecebido = url.searchParams.get("code");
      const estadoConfere = url.searchParams.get("state") === estado;
      if (url.pathname !== "/" || !estadoConfere || (!codigoRecebido && !url.searchParams.get("error"))) {
        res.writeHead(404);
        res.end();
        return;
      }
      const ok = Boolean(codigoRecebido);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><meta charset="utf-8"><title>Kyro</title><body style="font-family:system-ui;padding:40px;background:#f5f7fb;color:#172033"><h2>${ok ? "Outlook conectado." : "Não deu certo."}</h2><p>${ok ? "Pode fechar esta aba e voltar ao Kyro." : "Volte ao Kyro e tente de novo."}</p></body>`);
      clearTimeout(relogio);
      servidor.close();
      if (ok) resolver({ codigo: codigoRecebido!, redirecionamento: `http://localhost:${(servidor.address() as AddressInfo | null)?.port ?? porta}` });
      else rejeitar(new Error(url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "autorizacao_negada"));
    });
    let porta = 0;
    const relogio = setTimeout(() => {
      servidor.close();
      rejeitar(new Error("tempo_esgotado"));
    }, 180000);
    servidor.listen(0, "127.0.0.1", () => {
      porta = (servidor.address() as AddressInfo).port;
      const parametros = new URLSearchParams({
        client_id: clienteId,
        redirect_uri: `http://localhost:${porta}`,
        response_type: "code",
        response_mode: "query",
        scope: ESCOPO.join(" "),
        code_challenge: desafio,
        code_challenge_method: "S256",
        state: estado,
      });
      try {
        plataforma.abrirNoNavegador(`${AUTORIZACAO}?${parametros}`);
      } catch (e) {
        clearTimeout(relogio);
        servidor.close();
        rejeitar(e as Error);
      }
    });
  });
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: codigo, client_id: clienteId, redirect_uri: redirecionamento, grant_type: "authorization_code", code_verifier: verificador, scope: ESCOPO.join(" ") }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await r.json()) as { refresh_token?: string; access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !json.refresh_token) throw new Error(json.error_description ?? json.error ?? `http_${r.status}`);
  if (json.access_token) acessos.set(json.refresh_token, { token: json.access_token, expira: Date.now() + (json.expires_in ?? 3600) * 1000 - 60000 });
  return { clienteId, refresh: json.refresh_token };
}

const acessos = new Map<string, { token: string; expira: number }>();
const renovacoesEmAndamento = new Map<string, Promise<string>>();

async function renovarToken(c: CredencialOutlook): Promise<string> {
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clienteId, refresh_token: c.refresh, grant_type: "refresh_token", scope: ESCOPO.join(" ") }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!r.ok || !json.access_token) throw new Error(json.error === "invalid_grant" ? "autorizacao_expirada" : json.error ?? `http_${r.status}`);
  acessos.set(c.refresh, { token: json.access_token, expira: Date.now() + (json.expires_in ?? 3600) * 1000 - 60000 });
  if (json.refresh_token) acessos.set(json.refresh_token, { token: json.access_token, expira: Date.now() + (json.expires_in ?? 3600) * 1000 - 60000 });
  return json.access_token;
}

function tokenDeAcesso(c: CredencialOutlook): Promise<string> {
  const guardado = acessos.get(c.refresh);
  if (guardado && guardado.expira > Date.now()) return Promise.resolve(guardado.token);
  const emAndamento = renovacoesEmAndamento.get(c.refresh);
  if (emAndamento) return emAndamento;
  const renovacao = renovarToken(c).finally(() => renovacoesEmAndamento.delete(c.refresh));
  renovacoesEmAndamento.set(c.refresh, renovacao);
  return renovacao;
}

async function apiOutlook<T>(c: CredencialOutlook, caminho: string): Promise<T> {
  const token = await tokenDeAcesso(c);
  const r = await fetch(`${GRAPH}${caminho}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`http_${r.status} ${(await r.text().catch(() => "")).slice(0, 160)}`);
  return (await r.json()) as T;
}

interface MensagemGraph {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  importance?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
}

interface EventoGraph {
  id: string;
  subject?: string;
  webLink?: string;
  isAllDay?: boolean;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
}

function dataDo(v?: string): string {
  if (!v) return new Date().toISOString();
  const comFuso = /z$|[+-]\d\d:\d\d$/i.test(v);
  return new Date(comFuso ? v : `${v}Z`).toISOString();
}

function emailDaMensagem(m: MensagemGraph) {
  return {
    id: m.id,
    de: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "Outlook",
    assunto: m.subject?.trim() || "(sem assunto)",
    trecho: m.bodyPreview?.trim() || "",
    data: dataDo(m.receivedDateTime),
    naoLido: !m.isRead,
    importante: m.importance === "high",
  };
}

function eventoDoGraph(e: EventoGraph) {
  const inicio = dataDo(e.start?.dateTime);
  return { id: e.id, titulo: e.subject?.trim() || "(sem título)", data: inicio, hora: e.isAllDay ? undefined : new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), link: e.webLink };
}

export async function lerOutlook(texto: string) {
  const c = lerCredencialOutlook(texto);
  const hoje = new Date();
  const fim = new Date(hoje.getTime() + 7 * 86400000);
  const parametrosMensagens = new URLSearchParams({ "$top": "30", "$orderby": "receivedDateTime desc", "$select": "id,subject,bodyPreview,receivedDateTime,isRead,importance,from" });
  const parametrosEventos = new URLSearchParams({ startDateTime: hoje.toISOString(), endDateTime: fim.toISOString(), "$top": "30", "$orderby": "start/dateTime", "$select": "id,subject,start,end,isAllDay,webLink" });
  const [perfil, caixa, mensagens, eventos] = await Promise.all([
    apiOutlook<{ mail?: string; userPrincipalName?: string }>(c, "/me?$select=mail,userPrincipalName"),
    apiOutlook<{ totalItemCount?: number; unreadItemCount?: number }>(c, "/me/mailFolders/inbox?$select=totalItemCount,unreadItemCount"),
    apiOutlook<{ value?: MensagemGraph[] }>(c, `/me/mailFolders/inbox/messages?${parametrosMensagens}`),
    apiOutlook<{ value?: EventoGraph[] }>(c, `/me/calendarView?${parametrosEventos}`),
  ]);
  const recentes = (mensagens.value ?? []).map(emailDaMensagem);
  const agenda = (eventos.value ?? []).map(eventoDoGraph);
  const hojeLocal = hoje.toLocaleDateString("sv-SE");
  return {
    email: perfil.mail || perfil.userPrincipalName || "",
    naoLidos: caixa.unreadItemCount ?? 0,
    total: caixa.totalItemCount ?? 0,
    importantes: recentes.filter((e) => e.importante),
    recentes,
    agenda: { hoje: agenda.filter((e) => e.data.slice(0, 10) === hojeLocal).length, proximos: agenda },
  };
}
