import { useEffect } from "react";
import { create } from "zustand";
import { useAuth } from "../../estado/autenticacao";
import { aderenciasPonte } from "../../ponte/aderencias";
import { podeAcessarRota } from "../../servicos/permissoes";
import { consultarAppsEmpresa } from "./catalogoAppsEmpresa";
import { combinarPlanilhas, planilhasDasAderencias, type AjustePlanilha, type AlteracaoPlanilha, type PlanilhaDaEmpresa } from "./planilhasDaEmpresa";

const vazio = { token: null, originais: [], ajustes: null, erro: false, erroRobo: false };
const useCatalogo = create<{
  token: string | null;
  originais: PlanilhaDaEmpresa[];
  ajustes: AjustePlanilha[] | null;
  erro: boolean;
  erroRobo: boolean;
}>(() => vazio);
let revisao = 0;

export async function carregarPlanilhasEmpresa(signal?: AbortSignal) {
  const { token, usuario } = useAuth.getState();
  if (!token || !podeAcessarRota(usuario, "planilhasEmpresa", "empresa")) return;
  const pedido = ++revisao;
  const vigente = () => pedido === revisao && !signal?.aborted && useAuth.getState().token === token
    && podeAcessarRota(useAuth.getState().usuario, "planilhasEmpresa", "empresa");
  try {
    const prazo = AbortSignal.timeout(15_000);
    const cancelar = signal ? AbortSignal.any([signal, prazo]) : prazo;
    const [catalogo, robo] = await Promise.allSettled([
      consultarAppsEmpresa<{ ajustes: AjustePlanilha[] }>("planilhas-catalogo", token, undefined, cancelar),
      aderenciasPonte.configuracao(cancelar).then(({ configuracao }) => planilhasDasAderencias(configuracao)),
    ]);
    if (catalogo.status === "rejected") throw catalogo.reason;
    if (vigente()) useCatalogo.setState({
      token, ajustes: catalogo.value.ajustes, erro: false,
      originais: robo.status === "fulfilled" ? robo.value : [], erroRobo: robo.status === "rejected",
    });
  } catch {
    if (vigente()) useCatalogo.setState({ ...vazio, token, erro: true });
  }
}

export async function salvarAlteracaoPlanilha(token: string, alteracao: AlteracaoPlanilha) {
  const { ajustes } = await consultarAppsEmpresa<{ ajustes: AjustePlanilha[] }>(
    "planilhas-catalogo", token, alteracao, AbortSignal.timeout(15_000));
  const auth = useAuth.getState();
  if (auth.token !== token || auth.usuario?.perfil !== "dono") return;
  revisao++;
  useCatalogo.setState((atual) => ({ ...(atual.token === token ? atual : vazio), token, ajustes, erro: false }));
}

export function usarPlanilhasEmpresa() {
  const token = useAuth((s) => podeAcessarRota(s.usuario, "planilhasEmpresa", "empresa") ? s.token : null);
  const dono = useAuth((s) => s.usuario?.perfil === "dono");
  const remoto = useCatalogo();
  const atual = token && remoto.token === token ? remoto : vazio;
  const cadastro = atual.ajustes && combinarPlanilhas(atual.originais, atual.ajustes, dono);
  return { cadastro, itens: cadastro?.filter((planilha) => planilha.ativa) ?? null, erro: atual.erro, erroRobo: atual.erroRobo };
}

export function useSincronizarPlanilhasEmpresa(ativa: boolean, abriuPlanilhas: boolean) {
  const token = useAuth((s) => podeAcessarRota(s.usuario, "planilhasEmpresa", "empresa") ? s.token : null);
  useEffect(() => {
    if (!ativa || !token) return;
    const controle = new AbortController();
    const atualizar = () => void carregarPlanilhasEmpresa(controle.signal);
    atualizar();
    window.addEventListener("focus", atualizar);
    return () => { controle.abort(); window.removeEventListener("focus", atualizar); };
  }, [ativa, abriuPlanilhas, token]);
}
