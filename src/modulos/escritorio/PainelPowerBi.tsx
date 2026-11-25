import { useEffect, useState } from "react";
import { ChartNoAxesCombined, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { AvisoFaixa, Botao } from "../../componentes/basicos";
import { definirPopupPowerBi, NATIVO } from "../../desktop/desktop";
import { useAuth } from "../../estado/autenticacao";
import { consultarAppsEmpresa } from "./catalogoAppsEmpresa";
import "./painelPowerBi.css";

const RELATORIO = "Controle de Custos SAP";

function RelatorioPowerBi({ token }: { token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [carregandoQuadro, setCarregandoQuadro] = useState(true);
  const relatorioAberto = Boolean(url);

  useEffect(() => {
    if (!NATIVO || !relatorioAberto) return;
    void definirPopupPowerBi(true);
    return () => { void definirPopupPowerBi(false); };
  }, [relatorioAberto]);

  useEffect(() => {
    const controle = new AbortController();
    void consultarAppsEmpresa<{ url: string }>("power-bi", token, undefined, controle.signal)
      .then(({ url }) => { if (!controle.signal.aborted) setUrl(url); })
      .catch((falha: unknown) => {
        if (controle.signal.aborted) return;
        const codigo = falha instanceof Error ? falha.message : "";
        setErro(codigo === "power_bi_nao_configurado"
          ? "O relatório do Power BI ainda precisa ser configurado neste ambiente."
          : "Não foi possível carregar o relatório. Confira sua sessão e tente novamente.");
      });
    return () => controle.abort();
  }, [token, revisao]);

  const recarregar = () => {
    setUrl(null);
    setErro("");
    setCarregandoQuadro(true);
    setRevisao((atual) => atual + 1);
  };

  return <>
    <header className="power-bi-cabecalho">
      <div>
        <span className="power-bi-origem"><ChartNoAxesCombined size={15} aria-hidden="true" /> Power BI</span>
        <h1>{RELATORIO}</h1>
      </div>
      <div className="power-bi-acoes">
        {url && <a className="botao botao-secundario" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" />Abrir no Power BI</a>}
        <Botao icone={<RefreshCw size={15} />} onClick={recarregar} disabled={!url && !erro}>Recarregar relatório</Botao>
      </div>
    </header>
    {erro ? <AvisoFaixa tipo="alerta"><span role="alert">{erro}</span></AvisoFaixa> : <div className="power-bi-quadro" aria-busy={carregandoQuadro}>
      {carregandoQuadro && <span className="power-bi-carregando" role="status"><LoaderCircle size={16} className="girando" aria-hidden="true" />Carregando relatório…</span>}
      {url && <iframe
        title={`${RELATORIO} no Power BI`}
        src={url}
        allow="fullscreen"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
        onLoad={() => setCarregandoQuadro(false)}
      />}
    </div>}
  </>;
}

export default function PainelPowerBi() {
  const token = useAuth((estado) => estado.token);
  const perfil = useAuth((estado) => estado.usuario?.perfil);
  if (!token || (perfil !== "dono" && perfil !== "gerencia")) {
    return <AvisoFaixa tipo="alerta">Entre com sua conta do Kyro para abrir o Power BI da empresa.</AvisoFaixa>;
  }
  return <section className="power-bi-painel" aria-label="Power BI da empresa"><RelatorioPowerBi key={token} token={token} /></section>;
}
