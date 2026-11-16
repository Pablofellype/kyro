import { apiGoogle, autorizarGoogle, lerCredencialGmail, type CredencialGmail } from "./gmail.ts";
import type { AbaPlanilhaGoogle, DadosPlanilhasGoogle, FontePlanilhaGoogle, PlanilhaGoogle, PreviaPlanilhaGoogle } from "../src/tiposPlanilhas.ts";

const BASE = "https://sheets.googleapis.com/v4";
const ESCOPO = "https://www.googleapis.com/auth/spreadsheets.readonly";
const MAX_PLANILHAS = 5, MAX_LINHAS = 100, MAX_COLUNAS = 20;
interface CredencialPlanilhas extends CredencialGmail { servico: "planilhas"; planilhas: FontePlanilhaGoogle[] }
type Consulta = (credencial: CredencialGmail, caminho: string, sinal: AbortSignal) => Promise<unknown>;
const consultarGoogle: Consulta = (c, caminho, sinal) => apiGoogle(c, caminho, undefined, BASE, sinal);
const idValido = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{20,200}$/.test(id);
const gidValido = (id: unknown): id is number => Number.isSafeInteger(id) && Number(id) >= 0 && Number(id) <= 2147483647;
function objeto(valor: unknown): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) throw new Error("planilhas_resposta_invalida");
  return valor as Record<string, unknown>;
}
const urlDaFonte = (fonte: FontePlanilhaGoogle) => `https://docs.google.com/spreadsheets/d/${fonte.id}/edit${fonte.gid !== undefined ? `#gid=${fonte.gid}` : ""}`;

export function fontesDasPlanilhas(links: unknown): FontePlanilhaGoogle[] {
  if (typeof links !== "string") throw new Error("planilhas_links_invalidos");
  const lista = links.trim().split(/\s+/).filter(Boolean);
  if (!lista.length || lista.length > MAX_PLANILHAS) throw new Error("planilhas_quantidade_invalida");
  const fontes = lista.map((link) => {
    let url: URL;
    try { url = new URL(link); } catch { throw new Error("planilhas_links_invalidos"); }
    const id = /^\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/.exec(url.pathname)?.[1];
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password || !idValido(id)) throw new Error("planilhas_links_invalidos");
    const gid = new URLSearchParams(url.hash.slice(1)).get("gid") ?? url.searchParams.get("gid");
    if (gid !== null && (!/^\d+$/.test(gid) || !gidValido(Number(gid)))) throw new Error("planilhas_aba_invalida");
    return { id, ...(gid !== null ? { gid: Number(gid) } : {}) };
  });
  return fontes.filter((fonte, i) => fontes.findIndex((f) => f.id === fonte.id && f.gid === fonte.gid) === i);
}

export function lerCredencialPlanilhas(texto: string): CredencialPlanilhas {
  let valor: Record<string, unknown>;
  try { valor = objeto(JSON.parse(texto)); } catch { throw new Error("credencial_invalida"); }
  if (valor.servico !== "planilhas" || !Array.isArray(valor.planilhas) || !valor.planilhas.length || valor.planilhas.length > MAX_PLANILHAS) throw new Error("credencial_invalida");
  if (typeof valor.clienteId !== "string" || typeof valor.segredo !== "string" || typeof valor.refresh !== "string" || !valor.refresh) throw new Error("credencial_invalida");
  lerCredencialGmail(texto);
  for (const item of valor.planilhas) {
    const fonte = objeto(item);
    if (!idValido(fonte.id) || (fonte.gid !== undefined && !gidValido(fonte.gid))) throw new Error("credencial_invalida");
  }
  return valor as unknown as CredencialPlanilhas;
}

export async function credencialDasPlanilhas(dados: Record<string, unknown>, guardada: string | null = null, autorizar = autorizarGoogle): Promise<string> {
  const planilhas = fontesDasPlanilhas(dados.links);
  const anterior = guardada ? lerCredencialPlanilhas(guardada) : null;
  const clienteId = typeof dados.clienteId === "string" ? dados.clienteId.trim() : anterior?.clienteId ?? "";
  const segredo = typeof dados.segredo === "string" ? dados.segredo.trim() : "";
  if (!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(clienteId)) throw new Error("cliente_id_invalido");
  if ((!anterior || anterior.clienteId !== clienteId || segredo) && segredo.length < 8) throw new Error("planilhas_autorizacao_invalida");
  const credencial = anterior && anterior.clienteId === clienteId && !segredo
    ? anterior
    : await autorizar(clienteId, segredo, [ESCOPO], "Google Planilhas");
  if (!credencial.segredo || !credencial.refresh) throw new Error("planilhas_autorizacao_invalida");
  const resultado = JSON.stringify({ ...credencial, servico: "planilhas", planilhas });
  if (resultado.length > 4000) throw new Error("planilhas_configuracao_excessiva");
  return resultado;
}

export function configuracaoPublicaPlanilhas(texto: string) {
  const c = lerCredencialPlanilhas(texto);
  return { clienteId: c.clienteId, links: c.planilhas.map(urlDaFonte).join("\n"), temToken: Boolean(c.refresh) };
}

function motivoDoErro(erro: unknown): Error {
  const mensagem = erro instanceof Error ? erro.message : "";
  if (/planilhas_/.test(mensagem)) return new Error(mensagem);
  if (/SERVICE_DISABLED|accessNotConfigured|has not been used/i.test(mensagem)) return new Error("planilhas_api_desativada");
  if (/autorizacao_expirada|invalid_grant|http_401|sem_autorizacao/.test(mensagem)) return new Error("planilhas_autorizacao_expirada");
  if (/http_403/.test(mensagem)) return new Error("planilhas_sem_permissao");
  if (/http_404/.test(mensagem)) return new Error("planilhas_nao_encontrada");
  if (/http_429/.test(mensagem)) return new Error("planilhas_limite");
  return new Error("planilhas_falha_consulta");
}

async function pedir(c: CredencialPlanilhas, caminho: string, sinal: AbortSignal, consultar: Consulta) {
  if (sinal.aborted) throw new Error("planilhas_tempo_esgotado");
  try { return await consultar(c, caminho, sinal); }
  catch (erro) { if (sinal.aborted) throw new Error("planilhas_tempo_esgotado"); throw motivoDoErro(erro); }
}

async function lerUmaPlanilha(c: CredencialPlanilhas, fonte: FontePlanilhaGoogle, sinal: AbortSignal, consultar: Consulta): Promise<PlanilhaGoogle> {
  const campos = "spreadsheetId,properties(title),sheets(properties(sheetId,title,sheetType,hidden,gridProperties(rowCount,columnCount)))";
  const documento = objeto(await pedir(c, `/spreadsheets/${fonte.id}?${new URLSearchParams({ fields: campos })}`, sinal, consultar));
  const titulo = objeto(documento.properties).title;
  if (documento.spreadsheetId !== fonte.id || typeof titulo !== "string" || !Array.isArray(documento.sheets)) throw new Error("planilhas_resposta_invalida");
  const abas: AbaPlanilhaGoogle[] = documento.sheets.flatMap((item) => {
    const p = objeto(objeto(item).properties);
    if (p.hidden || (p.sheetType !== undefined && p.sheetType !== "GRID")) return [];
    const grade = objeto(p.gridProperties);
    if (!gidValido(p.sheetId) || typeof p.title !== "string" || !Number.isInteger(grade.rowCount) || !Number.isInteger(grade.columnCount) || Number(grade.rowCount) < 1 || Number(grade.columnCount) < 1) throw new Error("planilhas_resposta_invalida");
    return [{ id: Number(p.sheetId), titulo: p.title.slice(0, 200), linhas: Number(grade.rowCount), colunas: Number(grade.columnCount) }];
  });
  const aba = fonte.gid !== undefined ? abas.find((a) => a.id === fonte.gid) : abas[0];
  if (!aba) throw new Error("planilhas_aba_invalida");
  const ultimaColuna = String.fromCharCode(64 + Math.min(MAX_COLUNAS, aba.colunas));
  const intervalo = `'${aba.titulo.replaceAll("'", "''")}'!A1:${ultimaColuna}${Math.min(MAX_LINHAS, aba.linhas)}`;
  const resposta = objeto(await pedir(c, `/spreadsheets/${fonte.id}/values/${encodeURIComponent(intervalo)}?valueRenderOption=FORMATTED_VALUE`, sinal, consultar));
  if (typeof resposta.range !== "string" || !resposta.range) throw new Error("planilhas_resposta_invalida");
  if (resposta.values !== undefined && !Array.isArray(resposta.values)) throw new Error("planilhas_resposta_invalida");
  const valores = ((resposta.values ?? []) as unknown[]).slice(0, MAX_LINHAS).map((linha) => {
    if (!Array.isArray(linha)) throw new Error("planilhas_resposta_invalida");
    return linha.slice(0, MAX_COLUNAS).map((valor) => {
      if (valor === null || valor === undefined) return "";
      if (!["string", "number", "boolean"].includes(typeof valor)) throw new Error("planilhas_resposta_invalida");
      return String(valor).slice(0, 5000);
    });
  });
  const previa: PreviaPlanilhaGoogle = { abaId: aba.id, aba: aba.titulo, intervalo, valores, limitada: aba.linhas > MAX_LINHAS || aba.colunas > MAX_COLUNAS };
  return { id: fonte.id, titulo: titulo.slice(0, 200), link: urlDaFonte({ id: fonte.id, gid: aba.id }), abas, previa, erro: null };
}

export async function lerPlanilhasGoogle(texto: string, consultar: Consulta = consultarGoogle): Promise<DadosPlanilhasGoogle> {
  const c = lerCredencialPlanilhas(texto), sinal = AbortSignal.timeout(45000);
  const planilhas: PlanilhaGoogle[] = [];
  for (let i = 0; i < c.planilhas.length; i += 2) {
    planilhas.push(...await Promise.all(c.planilhas.slice(i, i + 2).map(async (fonte): Promise<PlanilhaGoogle> => {
      try { return await lerUmaPlanilha(c, fonte, sinal, consultar); }
      catch (erro) { return { id: fonte.id, titulo: "Planilha indisponível", link: urlDaFonte(fonte), abas: [], previa: null, erro: motivoDoErro(erro).message }; }
    })));
  }
  if (planilhas.every((p) => p.erro)) throw new Error(planilhas[0].erro!);
  return { planilhas, consultadoEm: new Date().toISOString() };
}

export async function lerAbaPlanilhaGoogle(texto: string, id: string, gid: number, consultar: Consulta = consultarGoogle): Promise<PlanilhaGoogle> {
  const c = lerCredencialPlanilhas(texto);
  if (!c.planilhas.some((p) => p.id === id) || !gidValido(gid)) throw new Error("planilhas_nao_configurada");
  return lerUmaPlanilha(c, { id, gid }, AbortSignal.timeout(30000), consultar);
}
