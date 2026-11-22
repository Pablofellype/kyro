import { useEffect } from "react";
import { create } from "zustand";
import { cabecalhosNiko, urlApi, useAuth } from "../../estado/autenticacao";
import { APLICATIVOS_EMPRESA, type AplicativoEmpresa } from "./aplicativosEmpresaConfig";

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

export async function salvarAppEmpresa(token: string, app: Omit<AplicativoEmpresa, "id"> & { id: string | null; criacaoId?: string }) {
  const { aplicativos } = await consultarAppsEmpresa<{ aplicativos: AplicativoEmpresa[] }>("catalogo", token, app);
  if (useAuth.getState().token !== token) return;
  versaoConsulta++;
  useCatalogoRemoto.setState({ token, aplicativos, erro: false });
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
