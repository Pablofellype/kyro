import { useEffect, useState } from "react";
import { ArrowUpRight, Check, PackageOpen, RefreshCw } from "lucide-react";
import { useInterface } from "../../estado/interface";
import { useIlha } from "../../estado/ilha";
import { useAuth } from "../../estado/autenticacao";
import { useConfig } from "../../estado/configuracoes";
import { consultarAppsEmpresa } from "../../modulos/escritorio/catalogoAppsEmpresa";
import { erroDeNotificacaoApps, solicitarConsultaAppsEmpresa, usarResumoDoInventario, type NotificacaoRecebida } from "../../modulos/escritorio/notificacoesAppsEmpresa";
import type { ResumoSolicitacaoMaterial } from "../../servicos/inventarioIntegracao";

interface HistoricoInventario {
  pedidos: ResumoSolicitacaoMaterial[];
  parcial: boolean;
  notificacao: NotificacaoRecebida | null;
}

function chaveDoPedido(item: ResumoSolicitacaoMaterial) {
  return item.chave || (item.protocolo ? `protocolo:${item.protocolo.toUpperCase()}` : JSON.stringify([item.tipo, item.itens, item.data, item.local]));
}

export function VisaoSolicitacoesMaterial() {
  const token = useAuth((s) => s.token);
  const avisosIlhaSilenciados = useConfig((s) => s.naoPerturbe || s.ilha.notificacoes === "nenhuma");
  const [revisao, setRevisao] = useState(0);
  const [historico, setHistorico] = useState<{ token: string; dados?: HistoricoInventario; erro?: string; carregando: boolean }>();
  const atual = historico?.token === token ? historico : undefined;
  const dados = atual?.dados;
  const { estado, total, novas, totalVisto, recentes, marcarVistas } = usarResumoDoInventario(dados?.notificacao);
  const consultando = Boolean(token) && (atual?.carregando ?? true);
  const inativo = dados ? !dados.notificacao && !estado?.notificacao : estado?.situacao === "inativo";
  const descricao = consultando ? "Consultando o inventário…"
    : atual?.erro ?? (dados ? "Inventário conectado." : estado?.erro ?? (estado?.situacao === "conectado" ? "Inventário conectado." : "Entre no Kyro para consultar os pedidos."));
  const chavesRecentes = new Set(recentes.map(chaveDoPedido));
  const lista = [
    ...recentes.map((item) => ({ item, novo: item.ordem > totalVisto })),
    ...(dados?.pedidos ?? []).filter((item) => !chavesRecentes.has(chaveDoPedido(item))).map((item) => ({ item, novo: false })),
  ].slice(0, 20);

  useEffect(() => {
    if (!token) return;
    const controle = new AbortController();
    setHistorico((anterior) => ({ token, dados: anterior?.token === token ? anterior.dados : undefined, carregando: true }));
    solicitarConsultaAppsEmpresa();
    void consultarAppsEmpresa<HistoricoInventario>("historico-inventario", token, undefined, controle.signal)
      .then((dados) => {
        if (!controle.signal.aborted) setHistorico({ token, dados, carregando: false });
      })
      .catch((falha) => {
        if (controle.signal.aborted) return;
        setHistorico((anterior) => ({
          token,
          dados: anterior?.token === token ? anterior.dados : undefined,
          carregando: false,
          erro: erroDeNotificacaoApps(falha, "Não foi possível carregar os pedidos do inventário."),
        }));
      });
    return () => controle.abort();
  }, [token, revisao]);

  function abrir(pagina: "inventario" | "configuracoes") {
    const ui = useInterface.getState();
    if (pagina === "inventario") ui.irPara("appsEmpresa", { app: "materiais" });
    else ui.irPara("configuracoes", { secao: "geral" });
    useIlha.getState().recolher();
  }

  return (
    <section className="ilha-materiais" aria-label="Solicitações de material">
      <header>
        <PackageOpen size={22} aria-hidden="true" />
        <div>
          <h2>Solicitações de material</h2>
          <p role="status">{descricao}</p>
        </div>
      </header>
      {(estado?.notificacao || dados?.notificacao) && <div className="ilha-materiais-resumo">
        <strong>{novas === 1 ? "1 nova solicitação" : `${novas} novas solicitações`}</strong>
        <span>{total} {total === 1 ? "solicitação recebida" : "solicitações recebidas"} desde a ativação</span>
        {avisosIlhaSilenciados && <span>Os avisos da Ilha estão silenciados nas configurações do Kyro.</span>}
      </div>}
      <div className="ilha-materiais-acoes">
        <button className="ilha-botao" type="button" disabled={consultando || !token} onClick={() => setRevisao((valor) => valor + 1)}><RefreshCw size={14} />Verificar agora</button>
        {inativo && <button className="ilha-botao" type="button" onClick={() => abrir("configuracoes")}>Ativar avisos</button>}
        {novas > 0 && <button className="ilha-botao" type="button" onClick={marcarVistas}><Check size={14} />Marcar como vistas</button>}
        <button className="ilha-botao ilha-botao-primario" type="button" onClick={() => abrir("inventario")}><ArrowUpRight size={14} />Abrir inventário</button>
      </div>
      {dados?.parcial && <p>Há mais pedidos no inventário.</p>}
      {dados && lista.length === 0 && <p>Nenhum pedido foi encontrado no inventário.</p>}
      {lista.length > 0 && <ol className="ilha-materiais-lista" aria-label="Pedidos do inventário">
        {lista.map(({ item, novo }, indice) => <li key={`${chaveDoPedido(item)}:${indice}`} data-nova={novo ? "sim" : undefined}>
          <div className="ilha-materiais-item-topo">
            <strong>{item.tipo || "Solicitação de material"}</strong>
            {novo && <span className="ilha-materiais-nova">Nova</span>}
          </div>
          {item.solicitante && <span className="ilha-materiais-meta privado">Solicitante: {item.solicitante}</span>}
          {item.itens && <p>{item.itens}</p>}
          {(item.local || item.protocolo || item.data) && <span className="ilha-materiais-meta">
            {[item.local, item.protocolo, item.data].filter(Boolean).join(" · ")}
          </span>}
        </li>)}
      </ol>}
    </section>
  );
}
