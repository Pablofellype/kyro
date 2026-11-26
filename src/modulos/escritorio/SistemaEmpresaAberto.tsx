import { useId, useRef, useState } from "react";
import { AppWindow, Check, Copy, Ellipsis, ExternalLink, LoaderCircle, RefreshCw, X } from "lucide-react";
import { AvisoFaixa, Botao } from "../../componentes/basicos";
import { useInterface } from "../../estado/interface";
import { ORIGENS_DE_APPS_INCORPORADOS, type AplicativoEmpresa } from "./aplicativosEmpresaConfig";
import { PropostaDoAplicativo } from "./PropostaDoAplicativo";
import "./sistemaEmpresaAberto.css";

export function SistemaEmpresaAberto({ app, mobile = false, mostrarProposta = false }: { app: AplicativoEmpresa; mobile?: boolean; mostrarProposta?: boolean }) {
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [falhaAoCopiar, setFalhaAoCopiar] = useState(false);
  const opcoes = useRef<HTMLDialogElement>(null);
  const idOpcoes = useId();

  if (!app.url || app.status !== "disponivel") return null;
  const url = app.url;
  const incorporado = ORIGENS_DE_APPS_INCORPORADOS.has(new URL(url).origin);
  const fecharOpcoes = () => opcoes.current?.close();
  const abrirNoNavegador = (
    <a className="botao botao-secundario" href={url} target="_blank" rel="noopener noreferrer" onClick={fecharOpcoes}><ExternalLink size={15} />Abrir no navegador</a>
  );
  const acoes = <>
    {abrirNoNavegador}
    {incorporado && <Botao icone={<RefreshCw size={15} />} onClick={() => {
      fecharOpcoes();
      setCarregando(true);
      setTentativa((valor) => valor + 1);
    }}>Recarregar</Botao>}
    <Botao aria-label="Copiar link do sistema" title={url} icone={linkCopiado ? <Check size={15} /> : <Copy size={15} />} onClick={async () => {
      fecharOpcoes();
      try {
        await navigator.clipboard.writeText(url);
        setLinkCopiado(true);
        setFalhaAoCopiar(false);
        if (mobile) useInterface.getState().avisar("Link copiado.", undefined, "sucesso");
      } catch {
        setLinkCopiado(false);
        setFalhaAoCopiar(true);
      }
    }}><span role="status" aria-live="polite">{linkCopiado ? "Link copiado" : "Copiar link do sistema"}</span></Botao>
  </>;

  return (
    <section className={mobile ? "apps-empresa-visualizador apps-empresa-visualizador-mobile" : "apps-empresa-visualizador"} aria-label={`${app.nome} dentro do Kyro`}>
      <header className="apps-empresa-ferramentas">
        <div className="apps-empresa-sistema-titulo">
          <AppWindow size={19} aria-hidden="true" />
          <h1>{app.nome}</h1>
        </div>
        {mobile ? <button type="button" className="apps-empresa-opcoes-botao" aria-label="Opções do aplicativo" aria-haspopup="dialog" aria-controls={idOpcoes} onClick={() => opcoes.current?.showModal()}><Ellipsis size={22} /></button>
          : <div className="apps-empresa-ferramentas-acoes">{acoes}</div>}
      </header>
      {mobile && <dialog ref={opcoes} id={idOpcoes} className="apps-empresa-opcoes" aria-label="Opções do aplicativo" onClick={(evento) => {
        if (evento.target === evento.currentTarget) fecharOpcoes();
      }}>
        <div className="apps-empresa-opcoes-conteudo">
          <header>
            <h2>{app.nome}</h2>
            <button type="button" className="apps-empresa-opcoes-botao" aria-label="Fechar opções" onClick={fecharOpcoes}><X size={19} /></button>
          </header>
          <div className="apps-empresa-ferramentas-acoes">{acoes}</div>
        </div>
      </dialog>}
      {falhaAoCopiar && <div className="apps-empresa-copia-manual"><AvisoFaixa tipo="alerta">A cópia automática não ficou disponível. Selecione o link para copiar.</AvisoFaixa><input className="campo" aria-label="Link do sistema para copiar" readOnly value={app.url} onFocus={(evento) => evento.currentTarget.select()} /></div>}
      {mostrarProposta && <PropostaDoAplicativo app={app} recolhida />}
      {incorporado ? <div className="apps-empresa-quadro" aria-busy={carregando}>
        {carregando && <div className="apps-empresa-quadro-carregando" role="status"><LoaderCircle size={16} className="girando" /> Carregando página…</div>}
        <iframe
          key={tentativa}
          src={app.url}
          title={`${app.nome} — Apps Empresa`}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
          onLoad={() => setCarregando(false)}
        />
      </div> : (app.descricao || mobile) && <div className="apps-empresa-copia-manual">{app.descricao && <p>{app.descricao}</p>}{mobile && abrirNoNavegador}</div>}
    </section>
  );
}
