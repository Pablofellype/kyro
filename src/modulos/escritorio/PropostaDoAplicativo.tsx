import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Play } from "lucide-react";
import { Botao } from "../../componentes/basicos";
import { useAuth } from "../../estado/autenticacao";
import { baixarAnexoProposta } from "./catalogoAppsEmpresa";
import { TIPOS_DE_ANEXO, TIPOS_PROPOSTA, temProposta, type AnexoProposta, type AplicativoEmpresa, type TipoProposta } from "./aplicativosEmpresaConfig";
import "./propostaDoAplicativo.css";

function ArquivoDaProposta({ id, tipo, anexo, token }: { id: string; tipo: TipoProposta; anexo: Extract<AnexoProposta, { origem: "arquivo" }>; token: string }) {
  const [url, setUrl] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const arquivo = useRef("");
  const requisicao = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requisicao.current?.abort();
    if (arquivo.current) URL.revokeObjectURL(arquivo.current);
  }, []);

  async function carregar() {
    if (requisicao.current) return;
    const controle = new AbortController();
    requisicao.current = controle;
    setFalhou(false);
    setCarregando(true);
    try {
      const blob = await baixarAnexoProposta(token, id, tipo, controle.signal);
      if (controle.signal.aborted || useAuth.getState().token !== token) return;
      arquivo.current = URL.createObjectURL(blob);
      setUrl(arquivo.current);
    } catch {
      if (!controle.signal.aborted) setFalhou(true);
    } finally {
      requisicao.current = null;
      if (!controle.signal.aborted) setCarregando(false);
    }
  }

  return <>
    <span className="app-proposta-arquivo-nome">{anexo.nome}</span>
    {!url && <Botao pequeno disabled={carregando} onClick={() => void carregar()}>
      {carregando ? "Carregando…" : tipo === "video" ? "Carregar vídeo" : "Carregar PDF"}
    </Botao>}
    {falhou && <span role="alert">Não foi possível carregar este arquivo.</span>}
    {url && tipo === "video" && <video controls playsInline preload="metadata" src={url} aria-label={TIPOS_PROPOSTA.video.rotulo} />}
    {url && <a href={url} download={anexo.nome} className="botao botao-secundario botao-pequeno"><Download size={14} aria-hidden="true" />{tipo === "pdf" ? "Baixar PDF" : "Baixar vídeo"}</a>}
  </>;
}

export function PropostaDoAplicativo({ app, recolhida = false }: { app: AplicativoEmpresa; recolhida?: boolean }) {
  const token = useAuth((s) => s.token);
  if (!temProposta(app)) return null;
  return <details className="app-proposta" open={!recolhida}>
    <summary>Proposta</summary>
    <ul className="app-proposta-lista">
      {TIPOS_DE_ANEXO.map((tipo) => {
        const anexo = app.proposta?.[tipo];
        if (!anexo) return null;
        const Icone = tipo === "pdf" ? FileText : Play;
        return <li key={tipo} className="app-proposta-anexo">
          <strong><Icone size={15} aria-hidden="true" /> {TIPOS_PROPOSTA[tipo].rotulo}</strong>
          {anexo.origem === "link" ? <a className="botao botao-secundario botao-pequeno" href={anexo.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" />{tipo === "pdf" ? "Abrir PDF" : "Abrir vídeo"}</a>
            : token && <ArquivoDaProposta key={`${token}:${anexo.caminho}`} id={app.id} tipo={tipo} anexo={anexo} token={token} />}
        </li>;
      })}
    </ul>
  </details>;
}
