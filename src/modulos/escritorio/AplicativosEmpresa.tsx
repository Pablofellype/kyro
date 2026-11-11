import { useEffect, useState } from "react";
import { AppWindow, LoaderCircle, PackageOpen, RefreshCw, Wrench } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { AvisoFaixa, Botao } from "../../componentes/basicos";
import { cabecalhosNiko, useAuth, urlApi } from "../../estado/autenticacao";
import { APLICATIVOS_EMPRESA } from "./aplicativosEmpresaConfig";
import { SistemaEmpresaAberto } from "./SistemaEmpresaAberto";

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

export default function AplicativosEmpresa() {
  const token = useAuth((s) => s.token);
  const [appAberto, setAppAberto] = useState<string | null>(null);
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

  const selecionado = APLICATIVOS_EMPRESA.find((app) => app.id === appAberto && app.status === "disponivel" && app.url);
  if (selecionado) {
    return <SistemaEmpresaAberto key={selecionado.id} app={selecionado} aoVoltar={() => setAppAberto(null)} />;
  }

  return (
    <>
      <CabecalhoAba titulo="Apps Empresa" subtitulo="Acesse os sistemas da empresa em um só lugar." />
      <div className="apps-empresa-painel">
        <div className="apps-empresa-grade">
          {APLICATIVOS_EMPRESA.map((app) => {
            const emManutencao = app.status === "manutencao";
            return (
              <article className="apps-empresa-cartao" key={app.id} aria-label={app.nome}>
                <span className="apps-empresa-icone">{emManutencao ? <Wrench size={21} /> : <AppWindow size={21} />}</span>
                <div><h2>{app.nome}</h2><p>{app.descricao}</p></div>
                <Botao
                  pequeno
                  variante="secundario"
                  icone={emManutencao ? <Wrench size={13} /> : <AppWindow size={13} />}
                  disabled={emManutencao || !app.url}
                  aria-label={emManutencao ? `${app.nome}: em manutenção` : `Abrir ${app.nome}`}
                  onClick={() => { if (app.url && !emManutencao) setAppAberto(app.id); }}
                >
                  {emManutencao ? "Em manutenção" : "Abrir sistema"}
                </Botao>
              </article>
            );
          })}
        </div>

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
      </div>
    </>
  );
}
