import { useEffect, useState } from "react";
import { CalendarClock, Check, ListTodo, MessageCircle, Pause, Play, Plus, Timer, type LucideIcon } from "lucide-react";
import { useInterface } from "../../estado/interface";
import { formatarRelogio, restanteAtual, usePomodoro } from "../../estado/pomodoro";
import { habitoCumprido, tarefaPendente, tarefasDoDia, useRotina } from "../../estado/rotina";
import { hojeISO } from "../../utilitarios/datas";
import { T } from "../../textos/textos";
import { CARGO_KYRO, NOME_KYRO, PersonagemKyro } from "../../personagens/PersonagemKyro";
import "./timeNaIlha.css";

interface ResumoProps {
  icone: LucideIcon;
  titulo: string;
  valor: string | number;
  detalhe: string;
}

function Resumo({ icone: Icone, titulo, valor, detalhe }: ResumoProps) {
  return (
    <div className="time-kyro-resumo">
      <span className="time-kyro-resumo-icone" aria-hidden="true"><Icone size={14} /></span>
      <span className="time-kyro-resumo-texto">
        <span>{titulo}</span>
        <strong>{valor}</strong>
        <small>{detalhe}</small>
      </span>
    </div>
  );
}

export function VisaoTime() {
  const tarefas = useRotina((estado) => estado.tarefas);
  const habitos = useRotina((estado) => estado.habitos);
  const registros = useRotina((estado) => estado.registros);
  const irPara = useInterface((estado) => estado.irPara);
  const abrirCaptura = useInterface((estado) => estado.abrirCaptura);
  const pomodoro = usePomodoro();
  const [agora, setAgora] = useState(() => Date.now());
  const hoje = hojeISO();

  useEffect(() => {
    if (!pomodoro.rodando) return;
    setAgora(Date.now());
    const intervalo = window.setInterval(() => setAgora(Date.now()), 500);
    return () => window.clearInterval(intervalo);
  }, [pomodoro.rodando]);

  const tarefasHoje = tarefasDoDia(tarefas, hoje).filter(tarefaPendente);
  const habitosAtivos = habitos.filter((habito) => !habito.arquivado);
  const habitosPendentes = habitosAtivos.filter((habito) => !habitoCumprido(habito, registros[hoje]?.[habito.id])).length;
  const proximaTarefa = tarefasHoje.find((tarefa) => Boolean(tarefa.hora)) ?? tarefasHoje[0];
  const restante = restanteAtual(pomodoro, agora);
  const focoEmAndamento = pomodoro.rodando || pomodoro.restanteMs != null;
  const status = pomodoro.rodando
    ? T.pomodoro.etapas[pomodoro.etapa]
    : pomodoro.restanteMs != null
      ? "Pausado"
      : T.agentes.estados.ocioso;
  const fala = tarefasHoje.length > 0 ? T.falas.organizador.bomDia(tarefasHoje.length) : T.falas.organizador.livre;

  return (
    <div className="ilha-rolagem time-na-ilha">
      <section className="time-kyro-painel" aria-label={`Painel do ${NOME_KYRO}`}>
        <div className="time-kyro-cabecalho">
          <div className="time-kyro-figura" aria-hidden="true"><PersonagemKyro tamanho={116} /></div>
          <div className="time-kyro-identidade">
            <div className="time-kyro-nome-linha">
              <strong>{NOME_KYRO}</strong>
              <span className="time-kyro-status" data-ativo={pomodoro.rodando ? "sim" : "nao"}><i />{status}</span>
            </div>
            <span className="time-kyro-cargo">{CARGO_KYRO}</span>
            <p>{fala}</p>
          </div>
        </div>

        <div className="time-kyro-resumos">
          <Resumo
            icone={ListTodo}
            titulo={T.inicio.tarefasHoje}
            valor={tarefasHoje.length}
            detalhe={tarefasHoje.length === 1 ? "pendente hoje" : "pendentes hoje"}
          />
          <Resumo
            icone={Check}
            titulo="Hábitos"
            valor={habitosPendentes}
            detalhe={habitosAtivos.length === 0 ? "nenhum cadastrado" : "pendentes hoje"}
          />
          <Resumo
            icone={Timer}
            titulo={T.inicio.foco}
            valor={focoEmAndamento ? formatarRelogio(restante) : "—"}
            detalhe={focoEmAndamento ? status : "pronto para começar"}
          />
          <Resumo
            icone={CalendarClock}
            titulo="Próximo"
            valor={proximaTarefa?.hora ?? "—"}
            detalhe={proximaTarefa?.titulo ?? "Dia livre"}
          />
        </div>

        <div className="time-kyro-acoes" aria-label="Ações rápidas">
          <button type="button" className="time-kyro-acao" onClick={() => irPara("chat")}>
            <MessageCircle size={14} />
            <span>{T.ilha.conversar}</span>
          </button>
          <button type="button" className="time-kyro-acao" onClick={() => abrirCaptura(true)}>
            <Plus size={14} />
            <span>{T.inicio.novaTarefa}</span>
          </button>
          <button type="button" className="time-kyro-acao time-kyro-acao-primaria" onClick={() => pomodoro.alternar()}>
            {pomodoro.rodando ? <Pause size={14} /> : <Play size={14} />}
            <span>{pomodoro.rodando ? T.pomodoro.pausar : focoEmAndamento ? T.pomodoro.continuar : T.pomodoro.iniciar}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
