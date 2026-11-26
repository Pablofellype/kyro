import { useEffect, useRef, useState } from "react";
import { ChartNoAxesCombined, ExternalLink, LoaderCircle, Pencil, Plus, RefreshCw, Users } from "lucide-react";
import { AvisoFaixa, Botao, Campo } from "../../componentes/basicos";
import { definirPopupPowerBi, NATIVO } from "../../desktop/desktop";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import type { RelatorioPowerBi } from "../../tiposPowerBi";
import { salvarRelatorioPowerBi, usarCatalogoPowerBi } from "./catalogoPowerBi";
import "./painelPowerBi.css";

type Edicao = Omit<RelatorioPowerBi, "id"> & { id: string | null };

function GerenciarPowerBi({ token, relatorios }: { token: string; relatorios: RelatorioPowerBi[] }) {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const envio = useRef(false);
  const irPara = useInterface((s) => s.irPara);
  const abrir = (item: Edicao) => { setEdicao(item); setErro(""); };

  return <div className="power-bi-gerencia">
    <div className="power-bi-acoes">
      <Botao variante="primario" icone={<Plus size={15} />} disabled={salvando} onClick={() => abrir({ id: null, nome: "", url: "" })}>Adicionar relatório</Botao>
      <Botao icone={<Users size={15} />} onClick={() => irPara("configuracoes", { secao: "admin" })}>Permissões dos colaboradores</Botao>
    </div>
    {edicao && <form className="power-bi-edicao" aria-label={edicao.id ? "Editar relatório" : "Novo relatório"} onSubmit={async (evento) => {
      evento.preventDefault();
      if (envio.current) return;
      envio.current = true;
      setSalvando(true);
      setErro("");
      try {
        await salvarRelatorioPowerBi(token, edicao);
        if (useAuth.getState().token !== token) return;
        setEdicao(null);
        useInterface.getState().avisar("Relatório salvo.", undefined, "sucesso");
      } catch (falha) {
        const codigo = falha instanceof Error ? falha.message : "";
        setErro(codigo === "relatorio_power_bi_duplicado" ? "Este relatório já está no catálogo."
          : codigo === "relatorio_power_bi_invalido" ? "Informe um nome e cole o link de incorporação segura do Power BI."
            : "Não foi possível salvar o relatório. Tente novamente.");
      } finally {
        envio.current = false;
        setSalvando(false);
      }
    }}>
      <Campo rotulo="Nome do relatório" id="power-bi-nome" obrigatorio>
        <input id="power-bi-nome" className="campo" value={edicao.nome} required maxLength={120} disabled={salvando} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
      </Campo>
      <Campo rotulo="Link de incorporação" id="power-bi-link" obrigatorio dica="Use o link do Power BI para site ou portal seguro.">
        <input id="power-bi-link" className="campo" type="url" placeholder="https://app.powerbi.com/reportEmbed…" value={edicao.url} required maxLength={4096} disabled={salvando} onChange={(e) => setEdicao({ ...edicao, url: e.target.value })} />
      </Campo>
      {erro && <AvisoFaixa tipo="erro"><span role="alert">{erro}</span></AvisoFaixa>}
      <div className="power-bi-acoes">
        <Botao disabled={salvando} onClick={() => setEdicao(null)}>Cancelar</Botao>
        <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar relatório"}</Botao>
      </div>
    </form>}
    {relatorios.length > 0 ? <ul className="power-bi-lista">
      {relatorios.map((item) => <li key={item.id}>
        <strong>{item.nome}</strong>
        <Botao pequeno icone={<Pencil size={14} />} aria-label={`Editar ${item.nome}`} disabled={salvando} onClick={() => abrir(item)}>Editar</Botao>
      </li>)}
    </ul> : <p>Cadastre um relatório para começar.</p>}
  </div>;
}

function VisualizadorPowerBi({ relatorio }: { relatorio: RelatorioPowerBi }) {
  const [carregando, setCarregando] = useState(true);
  return <div className="power-bi-quadro" aria-busy={carregando}>
    {carregando && <span className="power-bi-carregando" role="status"><LoaderCircle size={16} className="girando" aria-hidden="true" />Carregando relatório…</span>}
    <iframe
      title={`${relatorio.nome} no Power BI`}
      src={relatorio.url}
      allow="fullscreen"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
      onLoad={() => setCarregando(false)}
    />
  </div>;
}

function PainelDaConta({ token, dono }: { token: string; dono: boolean }) {
  const modo = useInterface((s) => s.parametros.modo);
  const selecionado = useInterface((s) => s.parametros.relatorio);
  const irPara = useInterface((s) => s.irPara);
  const gerenciando = dono && modo === "gerenciar";
  const { relatorios, erro, atualizar } = usarCatalogoPowerBi(token);
  const [revisao, setRevisao] = useState(0);
  const relatorio = relatorios?.find((item) => item.id === selecionado) ?? relatorios?.[0];
  const relatorioAberto = Boolean(relatorio && !gerenciando);
  useEffect(() => {
    if (!NATIVO || !relatorioAberto) return;
    void definirPopupPowerBi(true);
    return () => { void definirPopupPowerBi(false); };
  }, [relatorioAberto]);
  const recarregar = () => { atualizar(); setRevisao((n) => n + 1); };

  return <section className="power-bi-painel" aria-label="Power BI da empresa">
    <header className="power-bi-cabecalho">
      <div>
        <span className="power-bi-origem"><ChartNoAxesCombined size={15} aria-hidden="true" /> Power BI</span>
        <h1>{gerenciando ? "Gerenciar relatórios" : relatorio?.nome ?? "Relatórios da empresa"}</h1>
      </div>
      <div className="power-bi-acoes">
        {gerenciando && relatorio && <Botao onClick={() => irPara("powerBi", { relatorio: relatorio.id })}>Voltar ao relatório</Botao>}
        {!gerenciando && relatorio && <a className="botao botao-secundario" href={relatorio.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" />Abrir no Power BI</a>}
        {!gerenciando && relatorio && <Botao icone={<RefreshCw size={15} />} onClick={recarregar}>Recarregar relatório</Botao>}
      </div>
    </header>
    {erro ? <AvisoFaixa tipo="alerta">
      Não foi possível carregar os relatórios.
      <Botao pequeno onClick={atualizar}>Tentar novamente</Botao>
    </AvisoFaixa> : !relatorios ? <p role="status">Carregando catálogo…</p>
      : gerenciando ? <GerenciarPowerBi token={token} relatorios={relatorios} />
        : relatorio ? <VisualizadorPowerBi key={`${relatorio.id}:${relatorio.url}:${revisao}`} relatorio={relatorio} />
          : <AvisoFaixa>{dono ? "Ainda não há relatórios cadastrados." : "Nenhum relatório Power BI foi liberado para a sua conta."}</AvisoFaixa>}
  </section>;
}

export default function PainelPowerBi() {
  const token = useAuth((estado) => estado.token);
  const perfil = useAuth((estado) => estado.usuario?.perfil);
  if (!token || (perfil !== "dono" && perfil !== "gerencia")) {
    return <AvisoFaixa tipo="alerta">Entre com sua conta do Kyro para abrir o Power BI da empresa.</AvisoFaixa>;
  }
  return <PainelDaConta key={`${token}:${perfil}`} token={token} dono={perfil === "dono"} />;
}
