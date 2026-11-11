import { useRef, useState } from "react";
import { AppWindow, ArrowLeft, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { Botao } from "../../componentes/basicos";
import { abrirLink } from "../../desktop/desktop";
import type { AplicativoEmpresa } from "./aplicativosEmpresaConfig";
import "./sistemaEmpresaAberto.css";

export function SistemaEmpresaAberto({ app, aoVoltar }: { app: AplicativoEmpresa; aoVoltar: () => void }) {
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const quadro = useRef<HTMLIFrameElement>(null);

  if (!app.url || app.status !== "disponivel") return null;

  return (
    <section className="apps-empresa-visualizador" aria-label={`${app.nome} dentro do Kyro`}>
      <header className="apps-empresa-ferramentas">
        <Botao icone={<ArrowLeft size={16} />} onClick={aoVoltar}>Voltar aos apps</Botao>
        <div className="apps-empresa-sistema-titulo">
          <AppWindow size={19} aria-hidden="true" />
          <h1>{app.nome}</h1>
        </div>
        <div className="apps-empresa-ferramentas-acoes">
          <Botao icone={<RefreshCw size={15} />} onClick={() => {
            setCarregando(true);
            setTentativa((valor) => valor + 1);
          }}>Recarregar</Botao>
          <Botao icone={<ExternalLink size={15} />} onClick={() => abrirLink(app.url!)}>Nova aba</Botao>
        </div>
      </header>
      <div className="apps-empresa-ajuda">
        <span>Se o sistema não aparecer ou pedir outra forma de acesso, use <strong>Nova aba</strong>.</span>
        <button type="button" onClick={() => quadro.current?.focus()}>Ir para o sistema</button>
      </div>
      <div className="apps-empresa-quadro" aria-busy={carregando}>
        {carregando && <div className="apps-empresa-quadro-carregando" role="status"><LoaderCircle size={16} className="girando" /> Carregando página…</div>}
        <iframe
          key={tentativa}
          ref={quadro}
          src={app.url}
          title={`${app.nome} — Apps Empresa`}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
          onLoad={() => setCarregando(false)}
        />
      </div>
    </section>
  );
}
