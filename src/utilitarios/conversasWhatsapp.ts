import type { ConversaWhatsapp } from "../ponte/whatsapp";
import { normalizarTexto } from "./basicos.ts";

export type FiltroDaLista = "todas" | "naoLidas" | "grupos";

export function filtrarConversas(conversas: ConversaWhatsapp[], filtro: FiltroDaLista, busca: string): ConversaWhatsapp[] {
  const termo = normalizarTexto(busca);
  return conversas.filter((c) => (filtro === "grupos" ? c.grupo : !c.grupo && (filtro === "todas" || c.naoLidas > 0)) && (!termo || normalizarTexto(c.nome).includes(termo)));
}

export function naoLidasDasConversas(conversas: ConversaWhatsapp[]): number {
  return conversas.reduce((total, c) => total + (c.grupo ? 0 : c.naoLidas), 0);
}

