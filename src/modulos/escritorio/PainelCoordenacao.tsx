import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, Clock3, ListTodo, MessageSquare, RefreshCw, Users } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { Botao } from "../../componentes/basicos";
import { useAgentes } from "../../estado/agentes";
import { useAuth, cabecalhosNiko, urlApi } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { useOrganizacao } from "../../estado/organizacao";
import { useRotina, tarefasDoDia } from "../../estado/rotina";
import { useWhatsapp } from "../../estado/whatsapp";
import { formatar, hojeISO } from "../../utilitarios/datas";
import { ocorrencias } from "../../utilitarios/itensDoCalendario";

interface UsuarioEquipe {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  perfil: "dono" | "usuario";
}

function hora(hora?: string) {
  return hora || "Dia todo";
}

export function PainelCoordenacao() {
  const irPara = useInterface((s) => s.irPara);
  const token = useAuth((s) => s.token);
  const usuario = useAuth((s) => s.usuario);
  const eventos = useOrganizacao((s) => s.eventos);
  const tarefas = useRotina((s) => s.tarefas);
  const alertas = useAgentes((s) => s.alertas);
  const atividades = useAgentes((s) => s.atividades);
  const naoLidas = useWhatsapp((s) => s.estado?.naoLidas ?? 0);
  const [usuarios, setUsuarios] = useState<UsuarioEquipe[]>([]);
  const [carregando, setCarregando] = useState(false);

  const hoje = hojeISO();
  const agenda = useMemo(() => eventos
    .filter((evento) => ocorrencias(evento, hoje, hoje).length > 0)
    .sort((a, b) => (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"))
    .slice(0, 6), [eventos, hoje]);
  const pendencias = useMemo(() => tarefasDoDia(tarefas, hoje)
    .filter((tarefa) => tarefa.status !== "concluida" && tarefa.status !== "cancelada")
    .slice(0, 6), [tarefas, hoje]);
  const avisos = alertas.filter((alerta) => !alerta.visto).slice(-5).reverse();
  const membrosAtivos = usuarios.filter((item) => item.ativo);
  const quantidadeMembros = usuarios.length || (usuario ? 1 : 0);

  const carregarUsuarios = async () => {
    if (!token || carregando) return;
    setCarregando(true);
    try {
      const resposta = await fetch(urlApi("/api/auth?acao=usuarios"), { headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}` } });
      if (!resposta.ok) return;
      const dados = await resposta.json().catch(() => ({})) as { usuarios?: UsuarioEquipe[] };
      setUsuarios(Array.isArray(dados.usuarios) ? dados.usuarios : []);
    } catch {
      // O painel continua útil mesmo quando a lista remota não responde.
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { void carregarUsuarios(); }, [token]);

  return (
    <>
      <CabecalhoAba
        titulo="Coordenação"
        subtitulo="Equipe, agenda, pendências e avisos da empresa em um só lugar."
        acoes={
          <>
            <Botao icone={<CalendarDays size={13} />} onClick={() => irPara("calendario")}>Nova reunião</Botao>
            <Botao icone={<MessageSquare size={13} />} onClick={() => irPara("chat")}>Abrir conversa</Botao>
          </>
        }
      />

      <div className="coordenacao-painel">
        <div className="coordenacao-resumo">
          <div className="coordenacao-metrica"><Users size={17} /><strong>{quantidadeMembros}</strong><span>Membros cadastrados</span></div>
          <div className="coordenacao-metrica"><ListTodo size={17} /><strong>{pendencias.length}</strong><span>Pendências de hoje</span></div>
          <div className="coordenacao-metrica"><CalendarDays size={17} /><strong>{agenda.length}</strong><span>Compromissos hoje</span></div>
          <div className="coordenacao-metrica"><Bell size={17} /><strong>{avisos.length + naoLidas}</strong><span>Avisos e mensagens</span></div>
        </div>

        <div className="coordenacao-grade">
          <section className="coordenacao-cartao coordenacao-cartao-largo">
            <header className="coordenacao-cartao-cabecalho">
              <div><span className="coordenacao-rotulo">Hoje</span><h2>Agenda da equipe</h2></div>
              <Botao pequeno variante="fantasma" onClick={() => irPara("calendario")}>Ver calendário</Botao>
            </header>
            {agenda.length === 0 ? (
              <div className="coordenacao-vazio"><CalendarDays size={18} /><span>Nenhum compromisso registrado para hoje.</span></div>
            ) : (
              <div className="coordenacao-lista">
                {agenda.map((evento) => (
                  <button type="button" className="coordenacao-linha" key={evento.id} onClick={() => irPara("calendario", { data: hoje })}>
                    <span className="coordenacao-hora"><Clock3 size={13} />{hora(evento.hora)}</span>
                    <span className="coordenacao-linha-titulo">{evento.titulo}</span>
                    <span className="coordenacao-linha-tipo">{evento.tipo === "evento" ? "Reunião" : "Aviso"}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="coordenacao-cartao">
            <header className="coordenacao-cartao-cabecalho">
              <div><span className="coordenacao-rotulo">Acompanhar</span><h2>Pendências</h2></div>
              <Botao pequeno variante="fantasma" onClick={() => irPara("chat")}>Distribuir</Botao>
            </header>
            {pendencias.length === 0 ? (
              <div className="coordenacao-vazio"><CheckCircle2 size={18} /><span>Nenhuma pendência para hoje.</span></div>
            ) : (
              <div className="coordenacao-lista">
                {pendencias.map((tarefa) => (
                  <button type="button" className="coordenacao-linha coordenacao-linha-tarefa" key={tarefa.id} onClick={() => irPara("journal", { data: hoje })}>
                    <ListTodo size={14} />
                    <span className="coordenacao-linha-titulo">{tarefa.titulo}</span>
                    {tarefa.hora && <span className="coordenacao-linha-tipo">{tarefa.hora}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="coordenacao-cartao">
            <header className="coordenacao-cartao-cabecalho">
              <div><span className="coordenacao-rotulo">Acesso</span><h2>Equipe</h2></div>
              <Botao pequeno variante="fantasma" icone={<RefreshCw size={12} />} onClick={() => void carregarUsuarios()} disabled={carregando}>Atualizar</Botao>
            </header>
            <div className="coordenacao-equipe">
              {(membrosAtivos.length ? membrosAtivos : usuario ? [{ ...usuario, ativo: true }] : []).slice(0, 6).map((membro) => (
                <div className="coordenacao-membro" key={membro.id}>
                  <span className="coordenacao-membro-avatar">{membro.nome.trim().slice(0, 1).toUpperCase() || "K"}</span>
                  <span className="coordenacao-membro-texto"><strong>{membro.nome}</strong><small>{membro.perfil === "dono" ? "Administrador" : "Membro"}</small></span>
                  <i className="coordenacao-membro-status" title="Acesso ativo" />
                </div>
              ))}
              {!membrosAtivos.length && !usuario && <div className="coordenacao-vazio"><Users size={18} /><span>Nenhum membro carregado.</span></div>}
            </div>
          </section>

          <section className="coordenacao-cartao">
            <header className="coordenacao-cartao-cabecalho">
              <div><span className="coordenacao-rotulo">Atenção</span><h2>Avisos recentes</h2></div>
              <Botao pequeno variante="fantasma" onClick={() => irPara("whatsapp")}>WhatsApp</Botao>
            </header>
            {avisos.length === 0 && naoLidas === 0 ? (
              <div className="coordenacao-vazio"><CheckCircle2 size={18} /><span>Nenhum aviso pendente.</span></div>
            ) : (
              <div className="coordenacao-lista">
                {naoLidas > 0 && <div className="coordenacao-aviso"><MessageSquare size={14} /><span>{naoLidas} mensagem(ns) não lida(s) no WhatsApp.</span></div>}
                {avisos.map((aviso) => <div className="coordenacao-aviso" key={aviso.id}><AlertTriangle size={14} /><span>{aviso.texto}</span></div>)}
              </div>
            )}
          </section>

          <section className="coordenacao-cartao coordenacao-cartao-largo">
            <header className="coordenacao-cartao-cabecalho"><div><span className="coordenacao-rotulo">Histórico</span><h2>Últimas atividades do Kyro</h2></div></header>
            {atividades.length === 0 ? (
              <div className="coordenacao-vazio"><span>Nenhuma atividade registrada ainda.</span></div>
            ) : (
              <div className="coordenacao-atividades">
                {atividades.slice(0, 5).map((atividade) => <div className="coordenacao-atividade" key={atividade.id}><span>{formatar(atividade.data, "HH:mm")}</span><p>{atividade.texto}</p></div>)}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
