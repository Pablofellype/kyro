import { useEffect } from "react";
import { create } from "zustand";
import { cabecalhosNiko, urlApi, useAuth } from "../../estado/autenticacao";
import { APLICATIVOS_EMPRESA, TIPOS_PROPOSTA, type AnexoProposta, type AplicativoEmpresa, type TipoProposta } from "./aplicativosEmpresaConfig";

export class ErroAppsEmpresa extends Error {}

export async function consultarAppsEmpresa<T>(acao: string, token: string | null, corpo?: object, signal?: AbortSignal): Promise<T> {
  const resposta = await fetch(urlApi(`/api/aplicativos-empresa?acao=${acao}`), {
    method: corpo ? "POST" : "GET",
    headers: {
      ...cabecalhosNiko(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(corpo ? { "Content-Type": "application/json" } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroAppsEmpresa(dados?.erro ?? `http_${resposta.status}`);
  if (!dados) throw new ErroAppsEmpresa("resposta_invalida");
  return dados as T;
}

interface CatalogoRemoto {
  token: string | null;
  aplicativos: AplicativoEmpresa[] | null;
  erro: boolean;
}

const useCatalogoRemoto = create<CatalogoRemoto>(() => ({ token: null, aplicativos: null, erro: false }));
let versaoConsulta = 0;

export function useCatalogoAppsEmpresa() {
  const token = useAuth((s) => s.token);
  const remoto = useCatalogoRemoto();
  const sessao = token && token === remoto.token ? remoto : null;
  return { aplicativos: sessao?.aplicativos ?? APLICATIVOS_EMPRESA, pronto: !!sessao?.aplicativos, erro: sessao?.erro ?? false };
}

export async function carregarCatalogoAppsEmpresa(token: string, signal?: AbortSignal) {
  const versao = ++versaoConsulta;
  try {
    const { aplicativos } = await consultarAppsEmpresa<{ aplicativos: AplicativoEmpresa[] }>("catalogo", token, undefined, signal);
    if (versao === versaoConsulta && !signal?.aborted && useAuth.getState().token === token) {
      useCatalogoRemoto.setState({ token, aplicativos, erro: false });
    }
  } catch {
    if (versao !== versaoConsulta || signal?.aborted || useAuth.getState().token !== token) return;
    useCatalogoRemoto.setState((s) => ({ token, aplicativos: s.token === token ? s.aplicativos : null, erro: true }));
  }
}

export async function salvarAppEmpresa(token: string, app: Omit<AplicativoEmpresa, "id"> & { id: string | null; criacaoId?: string }, signal?: AbortSignal) {
  const { aplicativos } = await consultarAppsEmpresa<{ aplicativos: AplicativoEmpresa[] }>("catalogo", token, app, signal);
  if (useAuth.getState().token !== token) return;
  versaoConsulta++;
  useCatalogoRemoto.setState({ token, aplicativos, erro: false });
}

export function erroDoArquivoProposta(tipo: TipoProposta, arquivo: Pick<File, "name" | "size" | "type">): string | undefined {
  const { mime, extensao, limiteMb } = TIPOS_PROPOSTA[tipo];
  const tipoDoArquivo = arquivo.type.toLowerCase();
  if (!arquivo.name.toLowerCase().endsWith(`.${extensao}`) || (tipoDoArquivo && tipoDoArquivo !== mime && tipoDoArquivo !== "application/octet-stream")) {
    return `Escolha um arquivo ${extensao.toUpperCase()}.`;
  }
  if (arquivo.size < 1) return "O arquivo está vazio.";
  if (arquivo.size > limiteMb * 1024 * 1024) return `O arquivo ultrapassa o limite de ${limiteMb} MB.`;
}

export async function enviarAnexoProposta(token: string, id: string, tipo: TipoProposta, arquivo: File, signal: AbortSignal): Promise<AnexoProposta> {
  if (erroDoArquivoProposta(tipo, arquivo)) throw new ErroAppsEmpresa("arquivo_proposta_invalido");
  const { mime } = TIPOS_PROPOSTA[tipo];
  const { caminho, token: tokenUpload } = await consultarAppsEmpresa<{ caminho: string; token: string }>("proposta-upload", token, { id, tipo }, signal);
  const { put } = await import("@vercel/blob/client");
  await put(caminho, arquivo, { token: tokenUpload, access: "private", contentType: mime, multipart: arquivo.size > 5 * 1024 * 1024, abortSignal: signal });
  return { origem: "arquivo", caminho, nome: arquivo.name.trim().slice(0, 160) };
}

export async function baixarAnexoProposta(token: string, id: string, tipo: TipoProposta, signal: AbortSignal): Promise<Blob> {
  const parametros = new URLSearchParams({ acao: "proposta-arquivo", app: id, tipo });
  const resposta = await fetch(urlApi(`/api/aplicativos-empresa?${parametros}`), {
    headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}` }, signal,
  });
  if (!resposta.ok) throw new ErroAppsEmpresa("arquivo_proposta_indisponivel");
  return resposta.blob();
}

export function useSincronizarCatalogoAppsEmpresa() {
  const token = useAuth((s) => s.usuario ? s.token : null);
  useEffect(() => {
    if (!token) {
      useCatalogoRemoto.setState({ token: null, aplicativos: null, erro: false });
      return;
    }
    const controle = new AbortController();
    const atualizar = () => void carregarCatalogoAppsEmpresa(token, controle.signal);
    atualizar();
    window.addEventListener("focus", atualizar);
    return () => {
      controle.abort();
      window.removeEventListener("focus", atualizar);
    };
  }, [token]);
}
