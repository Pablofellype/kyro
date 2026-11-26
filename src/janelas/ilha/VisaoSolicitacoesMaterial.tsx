import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, RefreshCw, UserRound } from "lucide-react";
import { useInterface } from "../../estado/interface";
import { useIlha } from "../../estado/ilha";
import { useAuth } from "../../estado/autenticacao";
import { useConfig } from "../../estado/configuracoes";
import { consultarAppsEmpresa } from "../../modulos/escritorio/catalogoAppsEmpresa";
import { avisoDaSolicitacao, categoriaDaSolicitacao, erroDeNotificacaoApps, solicitarConsultaAppsEmpresa, usarResumoDoInventario, type NotificacaoRecebida } from "../../modulos/escritorio/notificacoesAppsEmpresa";
import type { ReservaMaterial, ResumoSolicitacaoMaterial } from "../../servicos/inventarioIntegracao";

interface HistoricoInventario {
  pedidos: ReservaMaterial[];
  parcial: boolean;
  notificacao: NotificacaoRecebida | null;
}

const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "dml", rotulo: "DML" },
  { id: "epi", rotulo: "EPI" },
] as const;

function tipoDoPedido(pedido: ResumoSolicitacaoMaterial) {
  const rotulo = categoriaDaSolicitacao(pedido.tipo, pedido.local);
  if (rotulo === "Material DML") return "dml";
  if (rotulo === "Equipamento pessoal (EPI)") return "epi";
  return "material";
}

function chaveDoPedido(item: ResumoSolicitacaoMaterial) {
  return item.chave || (item.protocolo ? `protocolo:${item.protocolo.toUpperCase()}` : JSON.stringify([item.tipo, item.itens, item.data, item.local]));
}

export function materiaisDaReserva(itens: string) {
  return itens.split(/\s+[|·]\s+/).map((item) => item.trim()).filter(Boolean).map((item) => {
    const codigo = /\s+\[([\w.-]+)\]$/.exec(item);
    return codigo ? { material: item.slice(0, codigo.index), codigo: codigo[1] } : { material: item };
  });
}

function FotoDoSolicitante({ token, protocolo }: { token: string | null; protocolo?: string }) {
  const alvo = useRef<HTMLSpanElement>(null);
  const [foto, setFoto] = useState<string>();
  useEffect(() => {
    if (!token || !protocolo) return;
    const cancelar = new AbortController();
    const carregar = () => {
      void consultarAppsEmpresa<{ foto: string }>("foto-inventario", token, { protocolo }, cancelar.signal).then(({ foto: imagem }) => {
        if (!cancelar.signal.aborted && /^data:image\/(jpeg|png|webp);base64,/.test(imagem)) setFoto(imagem);
      }).catch(() => undefined);
    };
    const elemento = alvo.current;
    const observador = elemento && typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entradas) => {
      if (!entradas.some((entrada) => entrada.isIntersecting)) return;
      observador?.disconnect();
      carregar();
    }) : undefined;
    if (observador && elemento) observador.observe(elemento);
    else carregar();
    return () => { observador?.disconnect(); cancelar.abort(); };
  }, [token, protocolo]);
  return <span ref={alvo} className="ilha-materiais-pedido-icone" aria-hidden="true">
    {foto ? <img src={foto} alt="" onError={() => setFoto(undefined)} /> : <UserRound size={15} />}
  </span>;
}

export function mostrarPreviaLocal(pedido: ResumoSolicitacaoMaterial) {
  if (!import.meta.env.DEV) return;
  const { usuario } = useAuth.getState();
  if (!usuario || !pedido.solicitante) return;
  const aviso = avisoDaSolicitacao({ ...pedido, ordem: 0 });
  const ilha = useIlha.getState();
  if (ilha.revelar({
    ...aviso, detalhe: `Prévia local · ${aviso.detalhe}`,
    tipo: "info", aba: "materiais", destinatarioId: usuario.id,
  }, 10_000)) ilha.recolher();
}

export function VisaoSolicitacoesMaterial() {
  const token = useAuth((s) => s.token);
  const privacidade = useConfig((s) => s.privacidade);
  const avisosIlhaSilenciados = useConfig((s) => s.naoPerturbe || s.ilha.notificacoes === "nenhuma");
  const [revisao, setRevisao] = useState(0);
  const [filtro, setFiltro] = useState<typeof FILTROS[number]["id"]>("todos");
  const [historico, setHistorico] = useState<{ token: string; dados?: HistoricoInventario; erro?: string; carregando: boolean }>();
  const atual = historico?.token === token ? historico : undefined;
  const dados = atual?.dados;
  const { estado, total, totalVisto, recentes, marcarVistas } = usarResumoDoInventario(dados?.notificacao);
  const consultando = Boolean(token) && (atual?.carregando ?? true);
  const inativo = dados ? !dados.notificacao && !estado?.notificacao : estado?.situacao === "inativo";
  const erro = atual?.erro ?? (!dados ? estado?.erro : undefined);
  const recentesPorChave = new Map(recentes.map((item) => [chaveDoPedido(item), item.ordem]));
  const lista = (dados?.pedidos ?? []).map((item) => ({
    item, novo: (recentesPorChave.get(chaveDoPedido(item)) ?? 0) > totalVisto, categoria: tipoDoPedido(item),
  }));
  const novas = lista.filter(({ novo }) => novo).length;
  const visiveis = lista.filter(({ categoria }) => filtro === "todos" || filtro === categoria);
  const descricao = consultando && !dados ? "Consultando o inventário…"
    : erro ?? (!token && !lista.length ? "Entre no Kyro para consultar os pedidos." : "");
  const pedidosParaPrevia = import.meta.env.DEV ? (dados?.pedidos ?? []).filter((pedido) => pedido.solicitante) : [];
  const dml = pedidosParaPrevia.find((pedido) => categoriaDaSolicitacao(pedido.tipo, pedido.local) === "Material DML");
  const epi = pedidosParaPrevia.find((pedido) => categoriaDaSolicitacao(pedido.tipo, pedido.local) === "Equipamento pessoal (EPI)");

  useEffect(() => {
    if (!token) return;
    let ativa: AbortController | undefined;
    const atualizar = () => {
      if (document.hidden || ativa) return;
      const controle = new AbortController();
      ativa = controle;
      setHistorico((anterior) => ({ token, dados: anterior?.token === token ? anterior.dados : undefined, carregando: true }));
      void consultarAppsEmpresa<HistoricoInventario>("historico-inventario", token, undefined, controle.signal)
        .then((dados) => {
          if (!controle.signal.aborted) setHistorico({ token, dados, carregando: false });
        })
        .catch((falha) => {
          if (!controle.signal.aborted) setHistorico({
            token, carregando: false,
            erro: erroDeNotificacaoApps(falha, "Não foi possível carregar os pedidos do inventário."),
          });
        })
        .finally(() => { if (ativa === controle) ativa = undefined; });
    };
    atualizar();
    solicitarConsultaAppsEmpresa();
    const intervalo = window.setInterval(atualizar, 15_000);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      ativa?.abort();
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [token, revisao, total]);

  function abrir(pagina: "inventario" | "configuracoes") {
    const ui = useInterface.getState();
    if (pagina === "inventario") ui.irPara("appsEmpresa", { app: "materiais" });
    else ui.irPara("configuracoes", { secao: "geral" });
    useIlha.getState().recolher();
  }

  return (
    <section className="ilha-materiais" aria-label="Solicitações de material">
      <header className="ilha-materiais-topo">
        <h2>Solicitações de material</h2>
        <div className="ilha-materiais-acoes">
          <button className="ilha-botao ilha-materiais-acao-icone" type="button" disabled={consultando || !token}
            aria-label="Verificar agora" title="Verificar agora" onClick={() => setRevisao((valor) => valor + 1)}><RefreshCw size={14} /></button>
          <button className="ilha-botao" type="button" onClick={() => abrir("inventario")}><ArrowUpRight size={14} />Abrir inventário</button>
        </div>
      </header>
      {descricao && <p className="ilha-materiais-meta" role="status">{descricao}</p>}
      {lista.length > 0 && <div className="ilha-materiais-barra">
        <div className="ilha-materiais-filtros" role="group" aria-label="Filtrar solicitações">
          {FILTROS.map(({ id, rotulo }) => <button key={id} type="button" aria-pressed={id === filtro} onClick={() => setFiltro(id)}>{rotulo}</button>)}
        </div>
        {novas > 0 && <button className="ilha-botao" type="button" onClick={marcarVistas} title="Marcar como vistas"
          aria-label={`${novas === 1 ? "1 nova solicitação" : `${novas} novas solicitações`}. Marcar como vistas`}>
          <Check size={13} />{novas} {novas === 1 ? "nova" : "novas"}
        </button>}
      </div>}
      {visiveis.length > 0 && <ol className="ilha-materiais-lista" aria-label="Pedidos do inventário">
        {visiveis.map(({ item, novo }) => {
          const materiais = materiaisDaReserva(item.itens);
          const fotoDoPedido = item.fotoDisponivel && !privacidade ? item.protocolo : undefined;
          return <li key={chaveDoPedido(item)} data-nova={novo ? "sim" : undefined}>
            <details className="ilha-materiais-pedido">
              <summary>
                <FotoDoSolicitante key={`${token}:${fotoDoPedido}`} token={token} protocolo={fotoDoPedido} />
                <strong className="ilha-materiais-solicitante privado">{item.solicitante || "Solicitante não informado"}</strong>
                {novo && <span className="ilha-materiais-nova">Nova</span>}
                <ChevronDown className="ilha-materiais-seta" size={13} aria-hidden="true" />
              </summary>
              <div className="ilha-materiais-pedido-detalhes">
                {materiais.length ? <ul className="ilha-materiais-material">
                  {materiais.map(({ material, codigo }, indice) => <li key={indice}>
                    <span>{material}</span>{codigo && <span className="ilha-materiais-codigo">Cód. {codigo}</span>}
                  </li>)}
                </ul> : <p>Sem materiais discriminados.</p>}
                {item.codigoSap && <p className="ilha-materiais-meta">Código SAP {item.codigoSap}</p>}
              </div>
            </details>
          </li>;
        })}
      </ol>}
      {!visiveis.length && (lista.length > 0 || dados) && <p className="ilha-materiais-vazio">
        {lista.length > 0 ? "Nenhum pedido nesta categoria." : "Nenhuma reserva no Inventário."}
      </p>}
      {inativo && <button className="ilha-botao ilha-materiais-ativar" type="button" onClick={() => abrir("configuracoes")}>Ativar avisos</button>}
      {avisosIlhaSilenciados && !inativo && <p className="ilha-materiais-meta">Avisos da Ilha silenciados.</p>}
      {dados?.parcial && <p className="ilha-materiais-meta">Veja os demais pedidos no Inventário.</p>}
      {import.meta.env.DEV && token && <details className="ilha-materiais-previa">
        <summary>Prévia local da notificação <ChevronDown size={13} aria-hidden="true" /></summary>
        <p className="ilha-materiais-meta">{avisosIlhaSilenciados ? "Ative os avisos da Ilha nas configurações para ver a prévia."
          : dml || epi ? "A prévia usa um pedido existente no Inventário."
            : "Aguardando um pedido do Inventário com o nome do solicitante."}</p>
        <div className="ilha-materiais-acoes">
          <button className="ilha-botao" type="button" disabled={avisosIlhaSilenciados || !pedidosParaPrevia.length}
            onClick={() => { if (pedidosParaPrevia[0]) mostrarPreviaLocal(pedidosParaPrevia[0]); }}>Testar último pedido</button>
          <button className="ilha-botao" type="button" disabled={avisosIlhaSilenciados || !dml} onClick={() => { if (dml) mostrarPreviaLocal(dml); }}>Testar aviso DML</button>
          <button className="ilha-botao" type="button" disabled={avisosIlhaSilenciados || !epi} onClick={() => { if (epi) mostrarPreviaLocal(epi); }}>Testar aviso EPI</button>
        </div>
      </details>}
    </section>
  );
}
