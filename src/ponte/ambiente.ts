// A ponte existe no aplicativo instalado e no servidor de desenvolvimento.
// O site publicado usa as APIs remotas e não oferece as rotas /ponte.
export function ponteLocalDisponivel(): boolean {
  return import.meta.env.DEV || (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);
}
