import { create } from "zustand";
import { emit, listen } from "@tauri-apps/api/event";
import { mensagemDeErroApi } from "../utilitarios/erroApi";

export interface UsuarioAutenticado {
  id: number;
  email: string;
  nome: string;
  perfil: "dono" | "gerencia" | "visitante";
  roboAderencias: boolean;
}

export function primeiroNomeDaConta(usuario: Pick<UsuarioAutenticado, "nome"> | null): string {
  return usuario?.nome.trim().split(/\s+/, 1)[0] ?? "";
}

interface EstadoAuth {
  usuario: UsuarioAutenticado | null;
  carregando: boolean;
  token: string | null;
  erroVerificacao: string | null;
  definirUsuario: (u: UsuarioAutenticado | null, token?: string | null) => Promise<void>;
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

async function publicarAutenticacao(usuario: UsuarioAutenticado | null, token: string | null) {
  if (NATIVO) await emit(EVENTO_AUTENTICACAO, { usuario, token } satisfies MensagemAutenticacao).catch(() => undefined);
}

export function urlApi(caminho: string): string {
  const configurada = (import.meta.env.VITE_API_URL || "").trim();
  // Uma build nativa sem VITE_API_URL não possui as rotas /api dentro do Tauri.
  // No desenvolvimento, a URL relativa continua apontando para a ponte local.
  const baseUrl = (configurada || (NATIVO && import.meta.env.PROD ? API_PADRAO_DESKTOP : "")).replace(/\/+$/, "");
  return `${baseUrl}${caminho}`;
}

export function cabecalhosNiko(): Record<string, string> {
  const token = typeof document !== "undefined" && typeof document.querySelector === "function"
    ? document.querySelector('meta[name="niko-token"]')?.getAttribute("content")
    : null;
  let usuarioId = "";
  try {
    const usuario = JSON.parse(localStorage.getItem("kyro_usuario") ?? "null") as { id?: unknown } | null;
    if (typeof usuario?.id === "number" && Number.isSafeInteger(usuario.id) && usuario.id > 0) usuarioId = String(usuario.id);
  } catch {
    usuarioId = "";
  }
  return {
    "x-niko": "1",
    ...(token ? { "x-niko-token": token } : {}),
    ...(usuarioId ? { "x-kyro-user-id": usuarioId } : {}),
  };
}

export const useAuth = create<EstadoAuth>((set, get) => ({
  usuario: null,
  carregando: true,
  token: typeof window !== "undefined" ? localStorage.getItem("kyro_token") : null,
  erroVerificacao: null,

  definirUsuario: async (usuario, token) => {
    const sessao = estadoDaSessao(usuario, token ?? null);
    set({ ...sessao, erroVerificacao: null });
    await publicarAutenticacao(usuario, token ?? null);
  },

  logout: async () => {
    const token = get().token;
    // A sessão precisa continuar válida enquanto enviamos as preferências.
    // Sem rede, a fila por usuário conserva as alterações para o próximo login.
    try {
      const { salvarAgora } = await import("../ponte/armazenamento");
      await salvarAgora();
    } catch {
      // A indisponibilidade da sincronização não impede sair da conta.
    }
    if (token) {
      try {
        await fetch(urlApi("/api/auth?acao=logout"), {
          method: "POST",
          headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        // ignora erro de rede no logout
      }
    }
    await get().definirUsuario(null);
    if (NATIVO) window.location.reload();
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
      if (get().token !== token) return Boolean(get().usuario);
      if (!res.ok) {
        set({ carregando: false, erroVerificacao: mensagemDeErroApi(undefined, res.status) });
        return Boolean(get().usuario);
      }
      const dados = await res.json();
      if (get().token !== token) return Boolean(get().usuario);
      if (dados.autenticado && dados.usuario) {
        if (dados.usuario.perfil === "visitante") {
          await get().definirUsuario(null);
          return false;
        }
        const idArmazenado = cabecalhosNiko()["x-kyro-user-id"];
        const sessao = estadoDaSessao(dados.usuario, token);
        if (idArmazenado !== String(dados.usuario.id)) {
          window.location.reload();
          return false;
        }
        set({ ...sessao, erroVerificacao: null });
        return true;
      }
      set({ usuario: null, carregando: false, erroVerificacao: null });
      await get().definirUsuario(null);
      return false;
    } catch {
      if (get().token !== token) return Boolean(get().usuario);
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
    const usuario = mensagem.usuario ?? null;
    const token = mensagem.token ?? null;
    const anterior = useAuth.getState();
    const mudouSessao = anterior.token !== token || anterior.usuario?.id !== usuario?.id;
    const sessao = estadoDaSessao(usuario, token);
    if (mudouSessao) {
      // Cada WebView deve carregar o armazenamento da conta antes de exibir
      // a ilha ou o dock. Reutilizar a loja anterior pode gravar o visual antigo.
      window.location.reload();
      return;
    }
    useAuth.setState(sessao);
  }).catch(() => undefined);
}
