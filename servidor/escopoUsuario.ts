import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";

const contexto = new AsyncLocalStorage<string>();

function idSeguro(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40) || "local";
}

export function usuarioLocalAtual(): string {
  return contexto.getStore() ?? "local";
}

export function comUsuarioLocal<T>(usuarioId: string | undefined, trabalho: () => T): T {
  const id = usuarioId && /^\d+$/.test(usuarioId) && Number(usuarioId) > 0 ? usuarioId : "local";
  return contexto.run(id, trabalho);
}

export function pastaDoUsuario(base: string): string {
  const id = usuarioLocalAtual();
  return id === "local" || id === "1" ? base : join(base, "usuarios", idSeguro(id));
}

export function segredoDoUsuario(prefixo: string): string {
  const id = usuarioLocalAtual();
  return id === "local" || id === "1" ? prefixo : `${prefixo}-u${id}`.slice(0, 64);
}
