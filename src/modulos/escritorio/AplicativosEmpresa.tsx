import { useEffect, useState } from "react";
import { AppWindow, LoaderCircle, PackageOpen, RefreshCw } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { AvisoFaixa, Botao } from "../../componentes/basicos";
import { cabecalhosNiko, useAuth, urlApi, type UsuarioAutenticado } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { APLICATIVOS_EMPRESA, itensDoMenuAppsEmpresa } from "./aplicativosEmpresaConfig";
import { SistemaEmpresaAberto } from "./SistemaEmpresaAberto";
import { Aderencias } from "./Aderencias";

interface SolicitacaoEmpresa {
  id: number | string;
  solicitante?: string | null;
  visitante_nome?: string | null;
  visitante_email?: string | null;
  material_nome: string;
  variacao: string;
  quantidade: number;
  status: string;
  criado_em: string;
}

function SolicitacoesRecebidas() {
  const token = useAuth((s) => s.token);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoEmpresa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const carregarSolicitacoes = async () => {
    if (!token || carregando) return;
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch(urlApi("/api/solicitacoes"), { headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}` } });
      const dados = await resposta.json().catch(() => ({})) as { solicitacoes?: SolicitacaoEmpresa[]; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível carregar as solicitações.");
      setSolicitacoes(Array.isArray(dados.solicitacoes) ? dados.solicitacoes : []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as solicitações.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { void carregarSolicitacoes(); }, [token]);

  return <>
    <CabecalhoAba titulo="Solicitações recebidas" subtitulo="Acompanhe os pedidos de materiais recebidos pelo Kyro." />
    <section className="apps-empresa-solicitacoes" aria-label="Solicitações de materiais">
      <header className="apps-empresa-secao-cabecalho">
        <div><span className="coordenacao-rotulo">Sistema de materiais</span><h2>Solicitações recebidas no Kyro</h2><p>Pedidos feitos pelo formulário público do Kyro.</p></div>
        <Botao pequeno variante="fantasma" icone={carregando ? <LoaderCircle size={13} className="girando" /> : <RefreshCw size={13} />} onClick={() => void carregarSolicitacoes()} disabled={carregando}>Atualizar</Botao>
      </header>
      {erro && <AvisoFaixa tipo="erro">{erro}</AvisoFaixa>}
      {!carregando && solicitacoes.length === 0 ? <div className="apps-empresa-vazio"><PackageOpen size={18} /><span>Nenhuma solicitação recebida ainda.</span></div> : (
        <div className="apps-empresa-lista">
          {solicitacoes.map((item) => <div className="apps-empresa-linha" key={item.id}><div><strong>{item.material_nome}</strong><small>{item.solicitante || item.visitante_nome || "Visitante"}{item.variacao ? ` · ${item.variacao}` : ""}</small></div><span>{item.quantidade} un.</span><small>{item.status}</small><time>{new Date(item.criado_em).toLocaleDateString("pt-BR")}</time></div>)}
        </div>
      )}
    </section>
  </>;
}

export function ConteudoAplicativoEmpresa({ appId, usuario }: { appId: string; usuario: Pick<UsuarioAutenticado, "perfil" | "roboAderencias"> | null }) {
  if (!appId) return <>
    <CabecalhoAba titulo="Apps Empresa" subtitulo="Escolha um aplicativo na sublista de Apps Empresa no menu de navegação." />
    <div className="apps-empresa-vazio"><AppWindow size={20} /><span>Os aplicativos abrem diretamente aqui ao selecioná-los no menu.</span></div>
  </>;

  const item = itensDoMenuAppsEmpresa(usuario).find((app) => app.id === appId);
  if (!item) return <AvisoFaixa tipo="alerta">Este aplicativo não está disponível para sua conta.</AvisoFaixa>;
  if (!item.disponivel) return <AvisoFaixa tipo="alerta">{item.nome} está em manutenção.</AvisoFaixa>;
  if (appId === "aderencias") return <Aderencias />;
  if (appId === "solicitacoes") return <SolicitacoesRecebidas />;

  const app = APLICATIVOS_EMPRESA.find((atual) => atual.id === appId);
  return app ? <SistemaEmpresaAberto key={app.id} app={app} /> : null;
}

export default function AplicativosEmpresa() {
  const appId = useInterface((s) => s.parametros.app ?? "");
  const usuario = useAuth((s) => s.usuario);
  return <ConteudoAplicativoEmpresa appId={appId} usuario={usuario} />;
}
