import { useState } from "react";
import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { AvisoFaixa, Botao } from "../../componentes/basicos";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { podeAcessarRota } from "../../servicos/permissoes";
import { carregarPlanilhasEmpresa, usarPlanilhasEmpresa } from "./catalogoPlanilhasEmpresa";
import { GerenciarPlanilhasEmpresa } from "./GerenciarPlanilhasEmpresa";
import type { PlanilhaDaEmpresa } from "./planilhasDaEmpresa";
import "./painelPlanilhasEmpresa.css";

function VisualizadorPlanilha({ planilha }: { planilha: PlanilhaDaEmpresa }) {
  const [carregando, definirCarregando] = useState(true);
  const [revisao, definirRevisao] = useState(0);
  return <>
    <CabecalhoAba titulo={planilha.nome} rotulo="Planilhas" acoes={<>
      <a className="botao botao-secundario" href={planilha.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" />Abrir no Google Planilhas</a>
      <Botao icone={<RefreshCw size={15} />} onClick={() => { definirCarregando(true); definirRevisao((n) => n + 1); }}>Recarregar prévia</Botao>
    </>} />
    <p className="planilhas-empresa-dica">Se o Google pedir autenticação ou a prévia não abrir, use o botão para acessar a planilha com sua conta.</p>
    <div className="planilhas-empresa-quadro" aria-busy={carregando}>
      {carregando && <span className="planilhas-empresa-carregando" role="status"><LoaderCircle size={16} className="girando" aria-hidden="true" />Carregando prévia…</span>}
      <iframe key={revisao} src={planilha.previa} title={`Prévia de ${planilha.nome}`} referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin" onLoad={() => definirCarregando(false)} />
    </div>
  </>;
}

export default function PainelPlanilhasEmpresa() {
  const usuario = useAuth((s) => s.usuario);
  const token = useAuth((s) => s.token);
  const { planilha: id, modo } = useInterface((s) => s.parametros);
  const irPara = useInterface((s) => s.irPara);
  const { cadastro, itens, erro, erroRobo } = usarPlanilhasEmpresa();
  if (!podeAcessarRota(usuario, "planilhasEmpresa", "empresa")) return <AvisoFaixa tipo="alerta">As planilhas da empresa não estão disponíveis para sua conta.</AvisoFaixa>;
  const gerenciando = token && usuario?.perfil === "dono" && modo === "gerenciar";
  const planilha = itens?.find((p) => p.id === id) ?? itens?.[0];
  const tentar = <Botao pequeno onClick={() => void carregarPlanilhasEmpresa()}>Tentar novamente</Botao>;
  return <section className="planilhas-empresa" aria-label="Planilhas da empresa">
    {gerenciando || !planilha ? <CabecalhoAba titulo={gerenciando ? "Gerenciar planilhas" : "Planilhas da empresa"}
      acoes={gerenciando && planilha ? <Botao onClick={() => irPara("planilhasEmpresa", { planilha: planilha.id })}>Voltar à planilha</Botao> : undefined} /> : null}
    {erroRobo && <AvisoFaixa tipo="alerta">Não foi possível carregar as planilhas do Robô de Aderências. {tentar}</AvisoFaixa>}
    {erro ? <AvisoFaixa tipo="alerta">Não foi possível carregar a lista de planilhas. {tentar}</AvisoFaixa>
      : !cadastro ? <p role="status">Carregando planilhas…</p>
        : gerenciando ? <GerenciarPlanilhasEmpresa key={token} token={token} planilhas={cadastro} />
          : planilha ? <VisualizadorPlanilha key={`${planilha.id}:${planilha.previa}`} planilha={planilha} />
            : <p role="status">Nenhuma planilha disponível.</p>}
  </section>;
}
