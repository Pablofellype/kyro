import { create } from "zustand";

export interface UsuarioAutenticado {
  id: number;
  email: string;
  nome: string;
}

interface EstadoAuth {
  usuario: UsuarioAutenticado | null;
  carregando: boolean;
  token: string | null;
  definirUsuario: (u: UsuarioAutenticado | null, token?: string | null) => void;
  logout: () => Promise<void>;
  verificar: () => Promise<boolean>;
}

export function urlApi(caminho: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  return `${baseUrl}${caminho}`;
}

export const useAuth = create<EstadoAuth>((set, get) => ({
  usuario: null,
  carregando: true,
  token: typeof window !== "undefined" ? localStorage.getItem("kyro_token") : null,

  definirUsuario: (usuario, token) => {
    if (token) {
      localStorage.setItem("kyro_token", token);
      if (usuario) localStorage.setItem("kyro_usuario", JSON.stringify(usuario));
      set({ usuario, token, carregando: false });
    } else {
      localStorage.removeItem("kyro_token");
      localStorage.removeItem("kyro_usuario");
      set({ usuario: null, token: null, carregando: false });
    }
  },

  logout: async () => {
    const token = get().token;
    if (token) {
      try {
        await fetch(urlApi("/api/auth?acao=logout"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
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
      set({ carregando: false, usuario: null });
      return false;
    }
    try {
      const res = await fetch(urlApi("/api/auth?acao=verificar"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("erro_rede");
      const dados = await res.json();
      if (dados.autenticado && dados.usuario) {
        set({ usuario: dados.usuario, carregando: false });
        return true;
      }
    } catch {
      // Se falhar verificacao, desloga
    }
    get().definirUsuario(null);
    return false;
  },
}));
