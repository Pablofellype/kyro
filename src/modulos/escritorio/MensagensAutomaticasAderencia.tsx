import { useEffect, useState, type FormEvent } from "react";
import { CalendarClock, MessageSquare, RefreshCw } from "lucide-react";
import { AvisoFaixa, Botao, Campo, Cartao } from "../../componentes/basicos";
import { aderenciasPonte, type FrequenciaMensagemAderencia, type MensagensAutomaticasAderencia } from "../../ponte/aderencias";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const FREQUENCIAS: Record<FrequenciaMensagemAderencia, string> = { once: "Uma vez", daily: "Todos os dias", weekly: "Dias da semana" };
const SITUACOES: Record<string, string> = { active: "Agendada", running: "Enviando", paused: "Pausada", completed: "Concluída", failed: "Falhou", cancelled: "Cancelada" };
const ERROS: Record<string, string> = {
  agenda_whatsapp_desconectado: "Conecte o WhatsApp em Conexões e atualize a lista.",
  agenda_horario_invalido: "Escolha um horário com pelo menos um minuto de antecedência.",
  agenda_primeiro_dia_invalido: "O primeiro envio precisa cair em um dos dias selecionados.",
  agenda_dias_invalidos: "Selecione pelo menos um dia da semana.",
  agenda_mencoes_invalidas: "A seleção inclui pessoas que não estão mais no grupo. Atualize os participantes.",
  agenda_participantes_indisponiveis: "O WhatsApp não retornou os participantes desse grupo.",
  agenda_lista_indisponivel: "O WhatsApp não retornou a lista de agendamentos.",
  agenda_gateway_sem_confirmacao: "O WhatsApp não confirmou o agendamento. Atualize a lista antes de tentar de novo.",
  grupo_invalido: "Selecione um grupo da conta conectada.",
  resposta_muitas: "O limite de envios foi atingido. Aguarde um minuto.",
  gateway_remoto_indisponivel: "O servidor do WhatsApp está indisponível.",
  http_404: "O servidor do Kyro ainda precisa receber a atualização de mensagens automáticas.",
  nao_autenticado: "Entre novamente no Kyro para continuar.",
  permissao_negada: "Sua conta precisa ter acesso ao Robô de Aderências.",
};

function erroDaMensagem(erro: unknown, alternativo: string) {
  const chave = erro instanceof Error ? erro.message : "";
  return Object.hasOwn(ERROS, chave) ? ERROS[chave] : alternativo;
}

function dataDoEnvio(valor: string, fuso: string) {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return "Horário indisponível";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso || undefined }).format(data);
  } catch { return data.toLocaleString("pt-BR"); }
}

export function AbaMensagensAutomaticasAderencia({ conectado }: { conectado: boolean }) {
  const [dados, setDados] = useState<MensagensAutomaticasAderencia | null>(null);
  const [revisao, setRevisao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [jid, setJid] = useState("");
  const [texto, setTexto] = useState("");
  const [quando, setQuando] = useState("");
  const [frequencia, setFrequencia] = useState<FrequenciaMensagemAderencia>("once");
  const [dias, setDias] = useState<number[]>([]);
  const [mencao, setMencao] = useState("nenhuma");
  const [numeros, setNumeros] = useState<string[]>([]);
  const [participantes, setParticipantes] = useState<Array<{ numero: string; nome: string }> | null>(null);
  const [erroParticipantes, setErroParticipantes] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    setErroLista("");
    void aderenciasPonte.mensagensAutomaticas(controle.signal)
      .then((lista) => { if (!controle.signal.aborted) setDados(lista); })
      .catch((erro) => { if (!controle.signal.aborted) setErroLista(erroDaMensagem(erro, "Não foi possível carregar os grupos e agendamentos.")); })
      .finally(() => { if (!controle.signal.aborted) setCarregando(false); });
    return () => controle.abort();
  }, [conectado, revisao]);

  useEffect(() => {
    if (!jid || mencao !== "pessoas") return;
    const controle = new AbortController();
    setParticipantes(null);
    setErroParticipantes("");
    void aderenciasPonte.participantes(jid, controle.signal)
      .then((dados) => { if (!controle.signal.aborted) setParticipantes(dados.participantes); })
      .catch((erro) => {
        if (!controle.signal.aborted) setErroParticipantes(erroDaMensagem(erro, "Não foi possível carregar os participantes."));
      });
    return () => controle.abort();
  }, [jid, mencao, revisao]);

  function atualizar() { setRevisao((anterior) => anterior + 1); }

  async function agendar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado || erroLista || !dados?.grupos.some((grupo) => grupo.jid === jid)) return;
    const primeiroEnvio = new Date(quando);
    setConfirmacao("");
    if (!(primeiroEnvio.getTime() >= Date.now() + 60_000)) {
      setErroAcao(ERROS.agenda_horario_invalido);
      return;
    }
    if (frequencia === "weekly" && !dias.includes(primeiroEnvio.getDay())) {
      setErroAcao(dias.length ? ERROS.agenda_primeiro_dia_invalido : ERROS.agenda_dias_invalidos);
      return;
    }
    setErroAcao("");
    setOcupado(true);
    try {
      await aderenciasPonte.agendarMensagem({
        jid, texto, quando: primeiroEnvio.toISOString(), fuso, frequencia, dias,
        todos: mencao === "todos", numeros: mencao === "pessoas" ? numeros : [],
      });
      setTexto(""); setQuando(""); setNumeros([]); setMencao("nenhuma");
      setConfirmacao("Mensagem agendada.");
      atualizar();
    } catch (erro) {
      setErroAcao(erroDaMensagem(erro, "Não foi possível confirmar o agendamento. Atualize a lista antes de tentar novamente."));
    } finally { setOcupado(false); }
  }

  async function cancelar(id: string) {
    if (ocupado) return;
    setOcupado(true); setErroAcao(""); setConfirmacao("");
    try {
      await aderenciasPonte.cancelarMensagem(id);
      setConfirmacao("Envio cancelado.");
      atualizar();
    } catch (erro) {
      setErroAcao(erroDaMensagem(erro, "Não foi possível cancelar o envio."));
    } finally { setOcupado(false); }
  }

  return <section aria-label="Mensagens automáticas do WhatsApp" className="aderencias">
    {erroLista && <AvisoFaixa tipo="alerta">{erroLista}</AvisoFaixa>}
    {erroAcao && <AvisoFaixa tipo="erro">{erroAcao}</AvisoFaixa>}
    {confirmacao && <AvisoFaixa><span role="status">{confirmacao}</span></AvisoFaixa>}
    <Cartao titulo="Agendar mensagem" icone={<MessageSquare size={16} />}>
      <form className="formulario aderencias-formulario" onSubmit={(evento) => void agendar(evento)}>
        <fieldset className="aderencias-campos-agendamento" disabled={ocupado || carregando || Boolean(erroLista) || !dados?.grupos.length}>
          <Campo id="aderencia-mensagem-grupo" rotulo="Grupo do WhatsApp" obrigatorio>
            <select id="aderencia-mensagem-grupo" className="seletor" required value={jid} onChange={(evento) => { setJid(evento.target.value); setNumeros([]); }}>
              <option value="">{carregando ? "Carregando grupos…" : "Escolha um grupo"}</option>
              {dados?.grupos.map((grupo) => <option key={grupo.jid} value={grupo.jid}>{grupo.nome}</option>)}
            </select>
          </Campo>
          <Campo id="aderencia-mensagem-texto" rotulo="Mensagem" obrigatorio>
            <textarea id="aderencia-mensagem-texto" className="campo" rows={4} required maxLength={4096} value={texto} onChange={(evento) => setTexto(evento.target.value)} />
          </Campo>
          <div className="aderencias-grade-2">
            <Campo id="aderencia-mensagem-quando" rotulo="Data e hora do primeiro envio" dica={`Fuso horário: ${fuso}`} obrigatorio>
              <input id="aderencia-mensagem-quando" className="campo" type="datetime-local" required value={quando} onChange={(evento) => setQuando(evento.target.value)} />
            </Campo>
            <Campo id="aderencia-mensagem-frequencia" rotulo="Repetição">
              <select id="aderencia-mensagem-frequencia" className="seletor" value={frequencia} onChange={(evento) => setFrequencia(evento.target.value as FrequenciaMensagemAderencia)}>
                {Object.entries(FREQUENCIAS).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
              </select>
            </Campo>
          </div>
          {frequencia === "weekly" && <div className="aderencias-dias" role="group" aria-label="Dias de envio">
            {DIAS.map((nome, dia) => <button key={nome} type="button" aria-label={nome} aria-pressed={dias.includes(dia)} onClick={() => setDias((atuais) => atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia])}>{nome.slice(0, 3)}</button>)}
          </div>}
          <Campo id="aderencia-mensagem-mencao" rotulo="Menções">
            <select id="aderencia-mensagem-mencao" className="seletor" value={mencao} onChange={(evento) => { setMencao(evento.target.value); setNumeros([]); }}>
              <option value="nenhuma">Sem menções</option>
              <option value="pessoas">Escolher participantes</option>
              <option value="todos">@todos · Mencionar todo o grupo</option>
            </select>
          </Campo>
          {mencao === "pessoas" && jid && <div className="aderencias-copia-lista" aria-label="Participantes do grupo">
            {erroParticipantes ? <span role="alert">{erroParticipantes}</span> : !participantes ? <span role="status">Carregando participantes…</span>
              : participantes.length === 0 ? <span>Nenhum participante disponível para menção individual.</span>
                : participantes.map(({ numero, nome }) => <label key={numero} className="aderencias-check">
                  <input type="checkbox" checked={numeros.includes(numero)} onChange={(evento) => setNumeros((atuais) => evento.target.checked ? [...atuais, numero] : atuais.filter((n) => n !== numero))} />
                  <span>{nome}{nome !== `+${numero}` && <small>+${numero}</small>}</span>
                </label>)}
          </div>}
          <div className="aderencias-acoes">
            <Botao type="submit" variante="primario" disabled={!texto.trim() || (mencao === "pessoas" && (!participantes || !numeros.length))} icone={<CalendarClock size={14} />}>{ocupado ? "Salvando…" : "Agendar mensagem"}</Botao>
          </div>
        </fieldset>
        {dados?.grupos.length === 0 && <p className="campo-dica">A conta conectada ainda não retornou nenhum grupo.</p>}
      </form>
    </Cartao>
    <Cartao titulo="Mensagens agendadas" icone={<CalendarClock size={16} />} acoes={<Botao pequeno disabled={carregando || ocupado} icone={<RefreshCw size={13} />} onClick={atualizar}>Atualizar</Botao>}>
      <div className="aderencias-cartao-corpo">
        {carregando && !dados && <p role="status">Carregando agendamentos…</p>}
        {dados?.agendadas.length === 0 && <p>Nenhuma mensagem agendada para grupos.</p>}
        {dados?.agendadas.map((agenda) => <article key={agenda.id} className="aderencias-planilha">
          <div className="aderencias-planilha-texto">
            <strong>{agenda.nome}</strong>
            <span>{agenda.resumo}</span>
            <small>{dataDoEnvio(agenda.proxima || agenda.quando, agenda.fuso)} · {agenda.frequencia === "weekly" ? agenda.dias.map((dia) => DIAS[dia]).join(", ") : FREQUENCIAS[agenda.frequencia as FrequenciaMensagemAderencia] ?? "Recorrente"} · {SITUACOES[agenda.situacao] ?? agenda.situacao}</small>
          </div>
          {["active", "paused", "failed"].includes(agenda.situacao) && <Botao pequeno disabled={ocupado} aria-label={`Cancelar envio para ${agenda.nome}`} onClick={() => void cancelar(agenda.id)}>Cancelar envio</Botao>}
        </article>)}
      </div>
    </Cartao>
  </section>;
}
