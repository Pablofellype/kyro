import { useEffect, useState } from "react";
import { useAuth } from "../../estado/autenticacao";
import { aderenciasPonte, aderenciasRemotas } from "../../ponte/aderencias";
import { useAderencias } from "../../estado/aderencias";
import type { GrupoAderencia } from "./aderenciasTipos";
import { carregarDadosDoPainel, DADOS_REMOTOS_VAZIOS, type DadosRemotosDoPainel } from "./dadosDoPainelEmpresa";

export type RotinasDoPainel = { situacao: "carregando" | "erro" } | { situacao: "prontas"; rotinas: GrupoAderencia[] };
const CARREGANDO_ROTINAS: RotinasDoPainel = { situacao: "carregando" };

export function usarDadosDoPainelEmpresa(ativo: boolean) {
  const token = useAuth((estado) => estado.token);
  const usuario = useAuth((estado) => estado.usuario);
  const [versao, setVersao] = useState(0);
  const [estado, setEstado] = useState<{ chave: string; dados: DadosRemotosDoPainel; aderencias?: RotinasDoPainel; carregando: boolean; atualizadoEm: Date | null }>({ chave: "", dados: DADOS_REMOTOS_VAZIOS, carregando: true, atualizadoEm: null });
  const podeVerRotinas = usuario?.perfil === "dono" || (usuario?.perfil === "gerencia" && usuario.roboAderencias);
  const chave = `${usuario?.id ?? ""}:${usuario?.perfil ?? ""}:${podeVerRotinas}:${token ?? ""}`;

  useEffect(() => {
    if (!ativo || !token || !usuario || usuario.perfil === "visitante") return;
    let vivo = true;
    const controle = new AbortController();
    const prazo = window.setTimeout(() => controle.abort(), 12000);
    const mesmaSessao = () => {
      const atual = useAuth.getState();
      return vivo && atual.token === token && atual.usuario?.id === usuario.id
        && atual.usuario.perfil === usuario.perfil && atual.usuario.roboAderencias === usuario.roboAderencias;
    };
    setEstado((anterior) => ({
      chave,
      dados: anterior.chave === chave ? anterior.dados : DADOS_REMOTOS_VAZIOS,
      aderencias: podeVerRotinas ? (anterior.chave === chave && anterior.aderencias) || CARREGANDO_ROTINAS : undefined,
      carregando: true,
      atualizadoEm: anterior.chave === chave ? anterior.atualizadoEm : null,
    }));
    const dados = carregarDadosDoPainel(usuario.perfil, token, controle.signal).then((dados) => {
      if (mesmaSessao()) setEstado((anterior) => ({ ...anterior, dados, atualizadoEm: dados.membros ? new Date() : anterior.atualizadoEm }));
    });
    const rotinas = podeVerRotinas
      ? (aderenciasRemotas(usuario) ? aderenciasPonte.configuracao(controle.signal).then(({ configuracao }) => configuracao.grupos) : Promise.resolve(useAderencias.getState().grupos))
        .then((rotinas) => {
          if (!Array.isArray(rotinas)) throw new Error("rotinas_indisponiveis");
          if (mesmaSessao()) setEstado((anterior) => ({ ...anterior, aderencias: { situacao: "prontas", rotinas }, atualizadoEm: new Date() }));
        })
        .catch(() => { if (mesmaSessao()) setEstado((anterior) => ({ ...anterior, aderencias: { situacao: "erro" } })); })
      : Promise.resolve();
    void Promise.all([dados, rotinas]).finally(() => {
      window.clearTimeout(prazo);
      if (mesmaSessao()) setEstado((anterior) => ({ ...anterior, carregando: false }));
    });
    return () => { vivo = false; controle.abort(); window.clearTimeout(prazo); };
  }, [ativo, chave, versao, token, usuario?.id, usuario?.perfil, usuario?.roboAderencias, podeVerRotinas]);

  useEffect(() => {
    if (!ativo) return;
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") setVersao((valor) => valor + 1);
    }, 60000);
    return () => window.clearInterval(intervalo);
  }, [ativo]);

  const atual = ativo && estado.chave === chave && token ? estado : undefined;
  return {
    ...(atual?.dados ?? DADOS_REMOTOS_VAZIOS),
    aderencias: podeVerRotinas && ativo && token ? atual?.aderencias ?? CARREGANDO_ROTINAS : undefined,
    carregando: atual?.carregando ?? (ativo && Boolean(token)),
    atualizadoEm: atual?.atualizadoEm ?? null,
    atualizar: () => setVersao((valor) => valor + 1),
  };
}
