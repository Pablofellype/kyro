import { useState } from "react";
import { AppWindow, Check, Copy, LoaderCircle, RefreshCw } from "lucide-react";
import { AvisoFaixa, Botao } from "../../componentes/basicos";
import type { AplicativoEmpresa } from "./aplicativosEmpresaConfig";
import "./sistemaEmpresaAberto.css";

export function SistemaEmpresaAberto({ app }: { app: AplicativoEmpresa }) {
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [falhaAoCopiar, setFalhaAoCopiar] = useState(false);

  if (!app.url || app.status !== "disponivel") return null;

  return (
    <section className="apps-empresa-visualizador" aria-label={`${app.nome} dentro do Kyro`}>
      <header className="apps-empresa-ferramentas">
        <div className="apps-empresa-sistema-titulo">
          <AppWindow size={19} aria-hidden="true" />
          <h1>{app.nome}</h1>
        </div>
        <div className="apps-empresa-ferramentas-acoes">
          <Botao icone={<RefreshCw size={15} />} onClick={() => {
            setCarregando(true);
            setTentativa((valor) => valor + 1);
          }}>Recarregar</Botao>
          <Botao aria-label="Copiar link do sistema" title={app.url} icone={linkCopiado ? <Check size={15} /> : <Copy size={15} />} onClick={async () => {
            try {
              await navigator.clipboard.writeText(app.url!);
              setLinkCopiado(true);
              setFalhaAoCopiar(false);
            } catch {
              setLinkCopiado(false);
              setFalhaAoCopiar(true);
            }
          }}><span role="status" aria-live="polite">{linkCopiado ? "Link copiado" : "Copiar link do sistema"}</span></Botao>
        </div>
      </header>
      {falhaAoCopiar && <div className="apps-empresa-copia-manual"><AvisoFaixa tipo="alerta">A cópia automática não ficou disponível. Selecione o link para copiar.</AvisoFaixa><input className="campo" aria-label="Link do sistema para copiar" readOnly value={app.url} onFocus={(evento) => evento.currentTarget.select()} /></div>}
      <div className="apps-empresa-quadro" aria-busy={carregando}>
        {carregando && <div className="apps-empresa-quadro-carregando" role="status"><LoaderCircle size={16} className="girando" /> Carregando página…</div>}
        <iframe
          key={tentativa}
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
