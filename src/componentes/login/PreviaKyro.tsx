import { useEffect, useState } from "react";
import { ArrowUpRight, Boxes, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, FileText, LayoutGrid, ListTodo, MessageCircle, MoreHorizontal, PanelTop, Pause, Play, Plug, Search, Settings2, ShieldCheck, Target, UserRound } from "lucide-react";
import { useConfig } from "../../estado/configuracoes";
import { IlhaNaEntrada } from "./IlhaNaEntrada";

const AMBIENTES = [
  { nome: "Empresa", titulo: "Sua operação, conectada.", descricao: "Aplicativos e solicitações no mesmo ambiente.", icone: LayoutGrid },
  { nome: "Pessoal", titulo: "Espaço para o seu dia.", descricao: "Rotina, tarefas e objetivos com o seu ritmo.", icone: UserRound },
  { nome: "Conexões", titulo: "Menos trocas de janela.", descricao: "As ferramentas do trabalho, perto de você.", icone: Plug },
];

/** Apresentação ilustrativa. Não consulta nem simula dados de uma conta. */
export function PreviaKyro() {
  const [ambiente, setAmbiente] = useState(0);
  const [pausada, setPausada] = useState(false);
  const [movimentoPermitido, setMovimentoPermitido] = useState(false);
  const [ilhaAberta, setIlhaAberta] = useState(false);
  const reduzirAnimacoes = useConfig((s) => s.reduzirAnimacoes);

  useEffect(() => {
    const preferencia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let intervalo: number | undefined;
    const atualizar = () => {
      window.clearInterval(intervalo);
      const animar = !pausada && !reduzirAnimacoes && !preferencia.matches && !document.hidden;
      setMovimentoPermitido(animar);
      if (animar) intervalo = window.setInterval(() => setAmbiente((atual) => (atual + 1) % AMBIENTES.length), 7000);
    };
    atualizar();
    preferencia.addEventListener("change", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(intervalo);
      preferencia.removeEventListener("change", atualizar);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [pausada, reduzirAnimacoes, ambiente]);

  useEffect(() => {
    if (!movimentoPermitido) return;
    setIlhaAberta(false);
    const abrir = window.setTimeout(() => setIlhaAberta(true), 1300);
    const recolher = window.setTimeout(() => setIlhaAberta(false), 5600);
    return () => {
      window.clearTimeout(abrir);
      window.clearTimeout(recolher);
    };
  }, [ambiente, movimentoPermitido]);

  return (
    <div className="kyro-tour" data-animando={movimentoPermitido} data-ilha-aberta={ilhaAberta} data-reduzir-movimento={reduzirAnimacoes}>
      <div className="kyro-tour-cena" aria-hidden="true">
        <div className="kyro-tour-base" />
        <div className="kyro-tour-janela">
          <div className="kyro-tour-barra"><span className="kyro-tour-pontos"><i /><i /><i /></span><span>KYRO <b>/ {AMBIENTES[ambiente].nome}</b></span><span className="kyro-tour-busca"><Search /> Buscar no seu espaço <small>⌘ K</small></span><MoreHorizontal /></div>
          <div className="kyro-tour-conteudo">
            <div className="kyro-tour-menu">
              <span className="kyro-tour-menu-titulo">SEU AMBIENTE</span>
              {AMBIENTES.map(({ nome, icone: Icone }, i) => <span className={ambiente === i ? "selecionado" : ""} key={nome}><Icone />{nome}<ChevronRight /></span>)}
              <i className="kyro-tour-menu-linha" />
              <span><CalendarDays /> Agenda</span><span><ListTodo /> Tarefas</span><span><MessageCircle /> WhatsApp</span>
              <span className="kyro-tour-menu-final"><Settings2 /> Ajustes</span>
            </div>
            <div className="kyro-tour-pagina" key={ambiente}>
              <div className="kyro-tour-migalha"><span>{AMBIENTES[ambiente].nome} / Visão geral</span><span className="kyro-tour-avatar">K</span></div>
              <h3>{AMBIENTES[ambiente].titulo}</h3>
              <p>{AMBIENTES[ambiente].descricao}</p>
              {ambiente === 0 && <>
                <div className="kyro-tour-secao"><span>APPS EMPRESA</span><span>Todos os aplicativos <ArrowUpRight /></span></div>
                <div className="kyro-tour-apps">
                  <div className="kyro-tour-app ativo"><Boxes /><strong>Materiais</strong><span>Solicitar e acompanhar</span><ArrowUpRight /></div>
                  <div className="kyro-tour-app"><LayoutGrid /><strong>Seus sistemas</strong><span>Um ponto de acesso</span><ArrowUpRight /></div>
                </div>
                <div className="kyro-tour-secao"><span>NO MESMO LUGAR</span><MoreHorizontal /></div>
                <div className="kyro-tour-linha"><span><CalendarDays /> Agenda, tarefas e conexões</span><ChevronRight /></div>
              </>}
              {ambiente === 1 && <>
                <div className="kyro-tour-secao"><span>SEU FOCO DE HOJE</span><MoreHorizontal /></div>
                <div className="kyro-tour-tarefa"><i><Check /></i><span>Planejar a semana<small>Um passo de cada vez.</small></span><span>ROTINA</span></div>
                <div className="kyro-tour-tarefa"><i /><span>Reservar tempo para estudar<small>O seu próximo objetivo.</small></span><span>ESTUDOS</span></div>
                <div className="kyro-tour-resumo"><span><Clock3 /><b>Seu tempo</b><small>Espaço para focar</small></span><span><Target /><b>Suas metas</b><small>O próximo passo</small></span></div>
              </>}
              {ambiente === 2 && <>
                <div className="kyro-tour-secao"><span>FERRAMENTAS DE TRABALHO</span><Plug /></div>
                <div className="kyro-tour-conector"><MessageCircle /><span>WhatsApp<small>Conversas da empresa</small></span><ChevronRight /></div>
                <div className="kyro-tour-conector"><CalendarDays /><span>Calendário<small>Seus compromissos em contexto</small></span><ChevronRight /></div>
                <div className="kyro-tour-conector"><FileText /><span>Seus aplicativos<small>Organizados do seu jeito</small></span><ChevronRight /></div>
                <span className="kyro-tour-privacidade"><ShieldCheck /> Conexões e permissões sob seu controle</span>
              </>}
            </div>
          </div>
          <div className="kyro-tour-status"><span>Um espaço. Todas as suas ferramentas.</span><span>PRÉVIA ILUSTRATIVA</span></div>
        </div>
        <div className="kyro-tour-flutuante"><span className="kyro-tour-flutuante-icone">{ambiente === 0 ? <Boxes /> : ambiente === 1 ? <ListTodo /> : <Plug />}</span><div><small>{ambiente === 0 ? "DA SOLICITAÇÃO À GESTÃO" : ambiente === 1 ? "SEU ESPAÇO PESSOAL" : "TUDO MAIS PRÓXIMO"}</small><strong>{ambiente === 0 ? "Cada pedido, no lugar certo." : ambiente === 1 ? "O dia ganha direção." : "O trabalho flui melhor."}</strong><span>{ambiente === 0 ? "Solicitar → acompanhar → resolver" : ambiente === 1 ? "Tarefas, rotina e objetivos." : "Ferramentas que trabalham juntas."}</span></div><ArrowUpRight /></div>
        <IlhaNaEntrada aberta={ilhaAberta} ambiente={ambiente} />
        <span className="kyro-tour-anotacao"><span />{ilhaAberta ? "Tudo à mão. Sem sair do seu espaço." : "Sua ilha. Sempre por perto."}</span>
      </div>
      <div className="kyro-tour-controles">
        <div aria-label="Explorar os ambientes do Kyro" className="kyro-tour-abas">
          {AMBIENTES.map(({ nome }, i) => <button key={nome} type="button" aria-pressed={ambiente === i} onClick={() => { setAmbiente(i); setIlhaAberta(false); }}><span>0{i + 1}</span>{nome}<i /></button>)}
        </div>
        <div className="kyro-tour-ferramentas"><button type="button" className="kyro-tour-ver-ilha" aria-pressed={ilhaAberta} aria-label={ilhaAberta ? "Recolher prévia da ilha" : "Explorar prévia da ilha"} onClick={() => { setPausada(true); setIlhaAberta((valor) => !valor); }}><PanelTop size={13} /><span>{ilhaAberta ? "Recolher ilha" : "Explorar a ilha"}</span></button><button type="button" className="kyro-tour-pausa" onClick={() => setPausada((valor) => !valor)} aria-label={pausada ? "Retomar apresentação automática" : "Pausar apresentação automática"}>{pausada ? <Play size={13} /> : <Pause size={13} />}</button></div>
      </div>
      <span className="kyro-tour-legenda"><CircleHelp size={12} /> Uma prévia do que você encontra ao entrar.</span>
    </div>
  );
}
