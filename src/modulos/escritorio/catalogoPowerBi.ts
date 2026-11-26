import { useEffect } from "react";
import { create } from "zustand";
import { useAuth } from "../../estado/autenticacao";
import type { RelatorioPowerBi } from "../../tiposPowerBi";
import { consultarAppsEmpresa } from "./catalogoAppsEmpresa";

type Catalogo = { relatorios: RelatorioPowerBi[] };
const useCatalogo = create<{ token: string | null; relatorios: RelatorioPowerBi[] | null; erro: boolean }>(() => ({
  token: null, relatorios: null, erro: false,
}));
let revisao = 0;

async function carregar(token: string, signal?: AbortSignal) {
  const consulta = ++revisao;
  const vigente = () => consulta === revisao && !signal?.aborted && useAuth.getState().token === token;
  try {
    const { relatorios } = await consultarAppsEmpresa<Catalogo>("power-bi-catalogo", token, undefined, signal);
    if (vigente()) useCatalogo.setState({ token, relatorios, erro: false });
  } catch {
    if (vigente()) useCatalogo.setState({ token, relatorios: null, erro: true });
  }
}

export async function salvarRelatorioPowerBi(token: string, relatorio: Omit<RelatorioPowerBi, "id"> & { id: string | null }) {
  const { relatorios } = await consultarAppsEmpresa<Catalogo>("power-bi-catalogo", token, relatorio);
  if (useAuth.getState().token !== token) return;
  revisao++;
  useCatalogo.setState({ token, relatorios, erro: false });
}

export function usarCatalogoPowerBi(token: string | null) {
  const resultado = useCatalogo();
  const atual = token && resultado.token === token ? resultado : null;
  return { relatorios: atual?.relatorios ?? null, erro: atual?.erro ?? false, atualizar: () => { if (token) void carregar(token); } };
}

export function useSincronizarCatalogoPowerBi(token: string | null, verificarPermissoes = false) {
  useEffect(() => {
    if (!token) return;
    let controle: AbortController | undefined;
    const atualizar = () => {
      controle?.abort();
      controle = new AbortController();
      void carregar(token, controle.signal);
    };
    atualizar();
    window.addEventListener("focus", atualizar);
    const intervalo = verificarPermissoes ? window.setInterval(atualizar, 60_000) : undefined;
    return () => {
      controle?.abort();
      window.removeEventListener("focus", atualizar);
      window.clearInterval(intervalo);
    };
  }, [token, verificarPermissoes]);
}
