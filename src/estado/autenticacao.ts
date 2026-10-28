import { create } from "zustand";
import { emit, listen } from "@tauri-apps/api/event";
import { mensagemDeErroApi } from "../utilitarios/erroApi";

export interface UsuarioAutenticado {
  id: number;
  email: string;
  nome: string;
  perfil: "dono" | "usuario";
  roboAderencias: boolean;
}

interface EstadoAuth {
  usuario: UsuarioAutenticado | null;
  carregando: boolean;
  token: string | null;
  erroVerificacao: string | null;
  definirUsuario: (u: UsuarioAutenticado | null, token?: string | null) => void;
  logout: () => Promise<void>;
  verificar: () => Promise<boolean>;
}

interface MensagemAutenticacao {
  usuario: UsuarioAutenticado | null;
  token: string | null;
}

const NATIVO = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const EVENTO_AUTENTICACAO = "niko://autenticacao";
const API_PADRAO_DESKTOP = "https://kyro-drab.vercel.app";

function estadoDaSessao(usuario: UsuarioAutenticado | null, token: string | null) {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("kyro_token", token);
      if (usuario) localStorage.setItem("kyro_usuario", JSON.stringify(usuario));
    } else {
      localStorage.removeItem("kyro_token");
      localStorage.removeItem("kyro_usuario");
    }
  }
  return { usuario, token, carregando: false };
}

function publicarAutenticacao(usuario: UsuarioAutenticado | null, token: string | null) {
  if (NATIVO) void emit(EVENTO_AUTENTICACAO, { usuario, token } satisfies MensagemAutenticacao).catch(() => undefined);
}

export function urlApi(caminho: string): string {
  const configurada = (import.meta.env.VITE_API_URL || "").trim();
  // Uma build nativa sem VITE_API_URL não possui as rotas /api dentro do Tauri.
  // No desenvolvimento, a URL relativa continua apontando para a ponte local.
  const baseUrl = (configurada || (NATIVO && import.meta.env.PROD ? API_PADRAO_DESKTOP : "")).replace(/\/+$/, "");
  return `${baseUrl}${caminho}`;
}

export function cabecalhosNiko(): Record<string, string> {
  const token = typeof document !== "undefined" ? document.querySelector('meta[name="niko-token"]')?.getAttribute("content") : null;
  return {
    "x-niko": "1",
    ...(token ? { "x-niko-token": token } : {}),
  };
}

export const useAuth = create<EstadoAuth>((set, get) => ({
  usuario: null,
  carregando: true,
  token: typeof window !== "undefined" ? localStorage.getItem("kyro_token") : null,
  erroVerificacao: null,

  definirUsuario: (usuario, token) => {
    const sessao = estadoDaSessao(usuario, token ?? null);
    set({ ...sessao, erroVerificacao: null });
    publicarAutenticacao(usuario, token ?? null);
  },

  logout: async () => {
    const token = get().token;
    if (token) {
      try {
        await fetch(urlApi("/api/auth?acao=logout"), {
          method: "POST",
          headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignora erro de rede no logout
      }
    }
    get().definirUsuario(null);
  },

  verificar: async () => {
    const token = get().token;
    if (!token) {
      set({ carregando: false, usuario: null, erroVerificacao: null });
      return false;
    }
    try {
      const res = await fetch(urlApi("/api/auth?acao=verificar"), {
        headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        set({ carregando: false, erroVerificacao: mensagemDeErroApi(undefined, res.status) });
        return Boolean(get().usuario);
      }
      const dados = await res.json();
      if (dados.autenticado && dados.usuario) {
        set({ usuario: dados.usuario, carregando: false, erroVerificacao: null });
        return true;
      }
      set({ usuario: null, carregando: false, erroVerificacao: null });
      get().definirUsuario(null);
      return false;
    } catch {
      // Uma queda temporária não pode apagar a sessão local nem expulsar o usuário.
      set({ carregando: false, erroVerificacao: mensagemDeErroApi(new TypeError("rede")) });
      return Boolean(get().usuario);
    }
  },
}));

if (NATIVO) {
  void listen<MensagemAutenticacao>(EVENTO_AUTENTICACAO, (evento) => {
    const mensagem = evento.payload;
    if (!mensagem || typeof mensagem !== "object") return;
    useAuth.setState(estadoDaSessao(mensagem.usuario ?? null, mensagem.token ?? null));
  }).catch(() => undefined);
}
