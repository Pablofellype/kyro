export type MotivoApi = "offline" | "timeout" | "nao_autorizado" | "sem_permissao" | "servidor" | "resposta_invalida" | "desconhecido";

export function motivoDoErroApi(erro: unknown, status?: number): MotivoApi {
  if (status === 401) return "nao_autorizado";
  if (status === 403) return "sem_permissao";
  if (typeof status === "number" && status >= 500) return "servidor";
  if (erro instanceof DOMException && erro.name === "AbortError") return "timeout";
  if (erro instanceof TypeError) return "offline";
  if (erro instanceof Error && /timeout|aborted/i.test(erro.message)) return "timeout";
  return "desconhecido";
}

export function mensagemDeErroApi(erro: unknown, status?: number): string {
  switch (motivoDoErroApi(erro, status)) {
    case "timeout":
      return "A API demorou demais para responder. Tente novamente em alguns segundos.";
    case "offline":
      return "O Kyro não conseguiu alcançar a API. Confira a conexão ou tente testar novamente.";
    case "nao_autorizado":
      return "Sua sessão expirou. Entre novamente para continuar.";
    case "sem_permissao":
      return "A API recusou esta solicitação. Verifique a configuração do acesso.";
    case "servidor":
      return "A API está indisponível neste momento. Tente novamente em alguns segundos.";
    case "resposta_invalida":
      return "A API respondeu em um formato inesperado. Tente novamente.";
    default:
      return "Não foi possível concluir a solicitação. Tente novamente.";
  }
}

export async function jsonSeguro<T = unknown>(resposta: Response): Promise<T | null> {
  try {
    return await resposta.json() as T;
  } catch {
    return null;
  }
}
