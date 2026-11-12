import { create } from "zustand";
import { whatsappPonte, type ConversaWhatsapp, type EstadoWhatsapp } from "../ponte/whatsapp";
import { useAuth } from "./autenticacao";

interface EstadoDoWhatsappNaInterface {
  estado: EstadoWhatsapp | null;
  pedidoEm: number;
  falhou: boolean;
  carregar: () => Promise<EstadoWhatsapp | null>;
  definir: (estado: EstadoWhatsapp) => void;
  atualizarConversa: (conversa: ConversaWhatsapp) => void;
  ignorar: (jid: string) => Promise<boolean>;
}

let ultimoMarco = 0;
const proximoMarco = () => (ultimoMarco = Math.max(Date.now(), ultimoMarco + 1));

export const useWhatsapp = create<EstadoDoWhatsappNaInterface>()((set, get) => ({
  estado: null,
  pedidoEm: 0,
  falhou: false,
  carregar: async () => {
    const inicio = proximoMarco();
    const sessao = useAuth.getState();
    const mesmaSessao = () => {
      const atual = useAuth.getState();
      return atual.usuario?.id === sessao.usuario?.id && atual.token === sessao.token;
    };
    try {
      const estado = await whatsappPonte.estado();
      if (!mesmaSessao() || inicio < get().pedidoEm) return get().estado;
      set({ estado, pedidoEm: inicio, falhou: false });
      return estado;
    } catch {
      if (mesmaSessao() && inicio >= get().pedidoEm) set({ falhou: true, pedidoEm: inicio });
      return null;
    }
  },
  definir: (estado) => set({ estado, pedidoEm: proximoMarco(), falhou: false }),
  ignorar: async (jid) => {
    const sessao = useAuth.getState();
    const estado = await whatsappPonte.ignorar(jid, true);
    const atual = useAuth.getState();
    if (atual.usuario?.id !== sessao.usuario?.id || atual.token !== sessao.token) return false;
    get().definir(estado);
    return true;
  },
  atualizarConversa: (conversa) => set((s) => {
    if (!s.estado) return {};
    const substituir = (itens: ConversaWhatsapp[]) => itens.map((c) => c.id === conversa.id ? conversa : c);
    return {
      estado: { ...s.estado, conversas: substituir(s.estado.conversas), abertas: substituir(s.estado.abertas ?? []) },
      pedidoEm: proximoMarco(), falhou: false,
    };
  }),
}));

useAuth.subscribe((atual, anterior) => {
  if (atual.usuario?.id !== anterior.usuario?.id || atual.token !== anterior.token) {
    useWhatsapp.setState({ estado: null, pedidoEm: proximoMarco(), falhou: false });
  }
});
