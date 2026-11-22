import { useEffect, useState } from "react";
import { AvisoFaixa, Botao } from "../../componentes/basicos";
import { NATIVO, permitirNotificacoes } from "../../desktop/desktop";
import { useAuth } from "../../estado/autenticacao";
import { consultarAppsEmpresa } from "../escritorio/catalogoAppsEmpresa";
import { erroDeNotificacaoApps, FONTES_DE_NOTIFICACOES, solicitarConsultaAppsEmpresa, useEstadoNotificacoesApps } from "../escritorio/notificacoesAppsEmpresa";
import { AlternadorAjuste, GrupoAjuste, LinhaAjuste } from "./LinhaAjuste";

type Preferencias = { fontesAtivas: string[] };

export function PreferenciasNotificacoesApps() {
  const token = useAuth((s) => s.token);
  const usuarioId = useAuth((s) => s.usuario?.id);
  const consultas = useEstadoNotificacoesApps((s) => s.consultas);
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [recarregar, setRecarregar] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controle = new AbortController();
    setErro("");
    void consultarAppsEmpresa<Preferencias>("preferencias", token, undefined, controle.signal)
      .then((dados) => { if (!controle.signal.aborted) setPreferencias(dados); })
      .catch(() => { if (!controle.signal.aborted) setErro("Não foi possível carregar as preferências de notificações."); });
    return () => controle.abort();
  }, [token, recarregar]);

  async function alterar(fonte: string, ativa: boolean) {
    if (!token || salvando) return;
    setSalvando(true);
    setErro("");
    try {
      const dados = await consultarAppsEmpresa<Preferencias>("preferencias", token, { fonte, ativa });
      if (useAuth.getState().token !== token) return;
      setPreferencias(dados);
      solicitarConsultaAppsEmpresa();
      if (ativa && NATIVO) void permitirNotificacoes();
    } catch (falha) {
      setErro(erroDeNotificacaoApps(falha, "Não foi possível salvar sua preferência. Tente novamente."));
    } finally {
      setSalvando(false);
    }
  }

  return <>
    <GrupoAjuste titulo="Notificações de aplicativos" />
    {FONTES_DE_NOTIFICACOES.map((fonte) => {
      const ativa = preferencias?.fontesAtivas.includes(fonte.id) ?? false;
      const estado = consultas[fonte.id];
      const consulta = estado?.usuarioId === usuarioId ? estado : undefined;
      const consultando = consulta?.situacao === "consultando";
      return <section key={fonte.id} aria-label={fonte.nome}>
        <AlternadorAjuste
          rotulo={fonte.nome}
          dica="Receba avisos no Kyro para as solicitações que chegarem após a ativação."
          ligado={ativa}
          desativado={!preferencias || salvando}
          aoMudar={(ligada) => void alterar(fonte.id, ligada)}
        />
        {ativa && <LinhaAjuste rotulo="Conexão com o inventário" dica={<span role="status">
          {consulta?.erro ?? (consulta?.situacao === "conectado" ? "Inventário conectado." : consultando ? "Consultando o inventário…" : "Aguardando consulta.")}
        </span>}>
          <Botao pequeno disabled={consultando || salvando} onClick={solicitarConsultaAppsEmpresa}>Verificar agora</Botao>
        </LinhaAjuste>}
      </section>;
    })}
    {erro && <AvisoFaixa tipo="alerta">{erro} {!preferencias && <Botao pequeno onClick={() => setRecarregar((valor) => valor + 1)}>Tentar novamente</Botao>}</AvisoFaixa>}
  </>;
}
