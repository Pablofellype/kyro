import { apiMicrosoft, lerCredencialMicrosoft, type CredencialOutlook } from "./outlook.ts";
import type { DadosTeams, DadosPlanner, MensagemTeams } from "../src/tiposMicrosoft.ts";

type Objeto = Record<string, unknown>;
type Consulta = (credencial: CredencialOutlook, caminho: string, sinal?: AbortSignal) => Promise<unknown>;
const LIMITE_CONVERSAS = 12;
const LIMITE_MENSAGENS = 12;
const LIMITE_TAREFAS = 1000;

function consultaComPrazo(consultar: Consulta): Consulta {
  const sinal = AbortSignal.timeout(45000);
  return async (credencial, caminho) => {
    if (sinal.aborted) throw new Error("microsoft_tempo_esgotado");
    try { return await consultar(credencial, caminho, sinal); }
    catch (erro) { if (sinal.aborted) throw new Error("microsoft_tempo_esgotado"); throw erro; }
  };
}

function objeto(valor: unknown): Objeto {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error("microsoft_resposta_invalida");
  return valor as Objeto;
}
const opcional = (valor: unknown): Objeto => typeof valor === "object" && valor !== null && !Array.isArray(valor) ? valor as Objeto : {};
const texto = (valor: unknown, limite = 500) => typeof valor === "string" ? valor.trim().slice(0, limite) : "";
function obrigatorio(valor: unknown): string {
  const resultado = texto(valor);
  if (!resultado) throw new Error("microsoft_resposta_invalida");
  return resultado;
}
function data(valor: unknown): string | null {
  const bruto = texto(valor);
  return bruto && Number.isFinite(Date.parse(bruto)) ? new Date(bruto).toISOString() : null;
}

function pagina(valor: unknown) {
  const dados = objeto(valor);
  if (!Array.isArray(dados.value) || (dados["@odata.nextLink"] != null && typeof dados["@odata.nextLink"] !== "string")) throw new Error("microsoft_resposta_invalida");
  return { itens: dados.value.map(objeto), proxima: texto(dados["@odata.nextLink"], 10000) || null };
}

export function linkMicrosoft(valor: unknown, tipo: "teams" | "planner"): string | null {
  try {
    const url = new URL(String(valor));
    const hosts = tipo === "teams" ? ["teams.microsoft.com", "teams.cloud.microsoft"] : ["planner.cloud.microsoft", "tasks.office.com", "planner.microsoft.com"];
    return url.protocol === "https:" && hosts.includes(url.hostname) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function textoDaMensagemTeams(valor: unknown): string {
  return texto(valor, 20000)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(?:p|div|br|li)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, codigo: string) => {
      const n = codigo[0].toLowerCase() === "x" ? parseInt(codigo.slice(1), 16) : Number(codigo);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, nome: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[nome.toLowerCase()] ?? ""))
    .replace(/\s+/g, " ").trim().slice(0, 1200);
}

async function emLotes<T, R>(itens: T[], executar: (item: T) => Promise<R>): Promise<R[]> {
  const resultado: R[] = [];
  for (let i = 0; i < itens.length; i += 4) resultado.push(...await Promise.all(itens.slice(i, i + 4).map(executar)));
  return resultado;
}

export async function lerTeams(credencial: string, consultar: Consulta = apiMicrosoft): Promise<DadosTeams> {
  const c = lerCredencialMicrosoft(credencial, "teams");
  consultar = consultaComPrazo(consultar);
  const parametros = new URLSearchParams({ "$top": String(LIMITE_CONVERSAS), "$expand": "members", "$orderby": "lastMessagePreview/createdDateTime desc" });
  const [perfilBruto, chats] = await Promise.all([
    consultar(c, "/me?$select=id,displayName,mail,userPrincipalName"),
    consultar(c, `/me/chats?${parametros}`).then(pagina),
  ]);
  const perfil = objeto(perfilBruto), usuarioId = obrigatorio(perfil.id);
  let parcial = Boolean(chats.proxima) || chats.itens.length > LIMITE_CONVERSAS;
  const conversas = await emLotes(chats.itens.slice(0, LIMITE_CONVERSAS), async (chat) => {
    const id = obrigatorio(chat.id);
    const membros = Array.isArray(chat.members) ? chat.members.map(opcional).filter((m) => m.userId !== usuarioId).map((m) => texto(m.displayName)).filter(Boolean) : [];
    const titulo = texto(chat.topic) || membros.slice(0, 4).join(", ") || (chat.chatType === "meeting" ? "Conversa de reunião" : "Conversa do Teams");
    const link = linkMicrosoft(chat.webUrl, "teams") ?? `https://teams.microsoft.com/l/chat/${encodeURIComponent(id)}/conversations`;
    const conversa = { id, titulo, tipo: texto(chat.chatType), atualizadaEm: data(chat.lastUpdatedDateTime), link, erro: null as string | null };
    try {
      const mensagens = pagina(await consultar(c, `/chats/${encodeURIComponent(id)}/messages?${new URLSearchParams({ "$top": String(LIMITE_MENSAGENS), "$orderby": "createdDateTime desc" })}`));
      const recentes = mensagens.itens.slice(0, LIMITE_MENSAGENS).flatMap((mensagem): MensagemTeams[] => {
        if (mensagem.deletedDateTime || mensagem.messageType !== "message") return [];
        const mensagemId = obrigatorio(mensagem.id), quando = data(mensagem.createdDateTime);
        if (!quando) throw new Error("microsoft_resposta_invalida");
        const remetente = opcional(mensagem.from), autor = opcional(remetente.user), app = opcional(remetente.application);
        const corpo = opcional(mensagem.body);
        const mencoes = Array.isArray(mensagem.mentions) ? mensagem.mentions.map(opcional) : [];
        return [{ id: mensagemId, conversaId: id, conversa: titulo, autor: texto(autor.displayName) || texto(app.displayName) || "Participante", texto: textoDaMensagemTeams(corpo.content) || "Mensagem com anexo", data: quando, link: linkMicrosoft(mensagem.webUrl, "teams") ?? link, mencionaMe: mencoes.some((m) => opcional(opcional(m.mentioned).user).id === usuarioId), importante: mensagem.importance === "high" || mensagem.importance === "urgent", minha: autor.id === usuarioId }];
      });
      return { conversa, mensagens: recentes };
    } catch (erro) {
      parcial = true;
      conversa.erro = erro instanceof Error ? erro.message : "microsoft_recurso_indisponivel";
      return { conversa, mensagens: [] };
    }
  });
  return { conta: texto(perfil.mail) || texto(perfil.userPrincipalName), conversas: conversas.map((r) => r.conversa), mensagens: conversas.flatMap((r) => r.mensagens).sort((a, b) => b.data.localeCompare(a.data)), parcial };
}

export async function lerPlanner(credencial: string, consultar: Consulta = apiMicrosoft): Promise<DadosPlanner> {
  const c = lerCredencialMicrosoft(credencial, "planner");
  consultar = consultaComPrazo(consultar);
  const perfil = objeto(await consultar(c, "/me?$select=id,displayName,mail,userPrincipalName"));
  obrigatorio(perfil.id);
  const dominio = texto(perfil.userPrincipalName).split("@").at(-1);
  const itens: Objeto[] = [], visitadas = new Set<string>();
  let proxima: string | null = "/me/planner/tasks", parcial = false;
  while (proxima && itens.length < LIMITE_TAREFAS && visitadas.size < 25) {
    if (visitadas.has(proxima)) throw new Error("microsoft_resposta_invalida");
    visitadas.add(proxima);
    const resposta = pagina(await consultar(c, proxima));
    itens.push(...resposta.itens);
    proxima = resposta.proxima;
  }
  parcial = Boolean(proxima) || itens.length > LIMITE_TAREFAS;
  const tarefas = itens.slice(0, LIMITE_TAREFAS).map((tarefa) => {
    const id = obrigatorio(tarefa.id), planoId = obrigatorio(tarefa.planId), criadaEm = data(tarefa.createdDateTime);
    if (!Number.isInteger(tarefa.percentComplete) || Number(tarefa.percentComplete) < 0 || Number(tarefa.percentComplete) > 100 || !criadaEm || (tarefa.dueDateTime != null && !data(tarefa.dueDateTime))) throw new Error("microsoft_resposta_invalida");
    return { id, titulo: obrigatorio(tarefa.title), planoId, plano: "Plano indisponível", progresso: Number(tarefa.percentComplete), prioridade: Number.isInteger(tarefa.priority) ? Number(tarefa.priority) : 5, prazo: data(tarefa.dueDateTime), criadaEm, link: dominio && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(dominio) ? `https://tasks.office.com/${encodeURIComponent(dominio)}/Home/Task/${encodeURIComponent(id)}` : "https://planner.cloud.microsoft/" };
  });
  const ids = [...new Set(tarefas.map((t) => t.planoId))];
  const planos = new Map(await emLotes(ids.slice(0, 40), async (id): Promise<[string, string | null]> => {
    try { return [id, obrigatorio(objeto(await consultar(c, `/planner/plans/${encodeURIComponent(id)}`)).title)]; }
    catch { return [id, null]; }
  }));
  const planosIndisponiveis = ids.filter((id) => !planos.get(id)).length;
  for (const tarefa of tarefas) tarefa.plano = planos.get(tarefa.planoId) ?? tarefa.plano;
  tarefas.sort((a, b) => Number(a.progresso === 100) - Number(b.progresso === 100) || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") || a.prioridade - b.prioridade);
  return { conta: texto(perfil.mail) || texto(perfil.userPrincipalName), tarefas, parcial, planosIndisponiveis };
}
