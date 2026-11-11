import { CalendarDays, Check, ChevronRight, Clock3, ListTodo, MessageCircle, Play, Plug, Settings2 } from "lucide-react";

/** Apenas a apresentação visual da ilha: nenhum dado ou comando da sessão real. */
export function IlhaNaEntrada({ aberta, ambiente }: { aberta: boolean; ambiente: number }) {
  return (
    <div className="kyro-tour-ilha" data-aberta={aberta}>
      <div className="kyro-tour-ilha-topo">
        <span className="kyro-tour-ilha-marca">k.</span>
        <div className="kyro-tour-ilha-abas">
          <span data-ativa={ambiente === 0}><CalendarDays />Hoje</span>
          <span data-ativa={ambiente === 1}><Clock3 />Foco</span>
          <span data-ativa={ambiente === 2}><Plug />Conexões</span>
        </div>
        <Settings2 />
        <span className="kyro-tour-ilha-ponto" />
      </div>
      <div className="kyro-tour-ilha-expansao">
        <div className="kyro-tour-ilha-recorte">
          <div className="kyro-tour-ilha-miolo" key={ambiente}>
            {ambiente === 0 && <>
              <div className="kyro-tour-ilha-chips"><span className="ativa">Agenda</span><span>Tarefas</span><span>Hábitos</span></div>
              <div className="kyro-tour-ilha-agenda"><span><CalendarDays /></span><div><small>O SEU DIA, À MÃO</small><strong>Espaço para o próximo passo.</strong><p>Compromissos e prioridades, juntos.</p></div><ChevronRight /></div>
              <div className="kyro-tour-ilha-tarefa"><span><Check /></span>Organizar as prioridades<small>HOJE</small></div>
              <div className="kyro-tour-ilha-tarefa"><span />Reservar tempo para você<ChevronRight /></div>
            </>}
            {ambiente === 1 && <div className="kyro-tour-ilha-foco">
              <div className="kyro-tour-ilha-relogio"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="44" /></svg><span>25:00<small>FOCO</small></span></div>
              <div><small>UMA COISA DE CADA VEZ</small><strong>Seu tempo merece atenção.</strong><p>Um momento para se concentrar.</p><span className="kyro-tour-ilha-iniciar"><Play /> Iniciar foco</span></div>
            </div>}
            {ambiente === 2 && <>
              <div className="kyro-tour-ilha-conexoes-titulo"><Plug /><div><strong>Suas ferramentas, por perto.</strong><small>Menos caminhos entre você e o trabalho.</small></div></div>
              <div className="kyro-tour-ilha-conector"><MessageCircle /><span>WhatsApp<small>Conversas da empresa</small></span><ChevronRight /></div>
              <div className="kyro-tour-ilha-conector"><CalendarDays /><span>Calendário<small>Compromissos em contexto</small></span><ChevronRight /></div>
              <div className="kyro-tour-ilha-conector"><ListTodo /><span>Tarefas<small>O próximo passo sempre à vista</small></span><ChevronRight /></div>
            </>}
            <div className="kyro-tour-ilha-rodape"><span>SUA ILHA. SEU RITMO.</span><span>PRÉVIA DO KYRO</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
