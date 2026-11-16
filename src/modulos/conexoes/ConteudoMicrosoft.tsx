import { CalendarDays, ExternalLink, MessageSquare, AtSign, ClipboardCheck } from "lucide-react";
import { AvisoFaixa, Vazio } from "../../componentes/basicos";
import { Metrica } from "./pecasDaJanela";
import { horarioRelativo, formatarData } from "../../utilitarios/datas";
import { contem } from "../../utilitarios/basicos";
import { tarefaPlannerAtrasada } from "../../utilitarios/conexoesMicrosoft";
import { mensagemDeErroDaConexao } from "../../utilitarios/errosDeConexao";
import type { DadosTeams, DadosPlanner } from "../../tiposMicrosoft";
import "./microsoftCorporativo.css";

function LinkMicrosoft({ href, texto }: { href: string | null; texto: string }) {
  if (!href || !/^https:\/\/(?:teams\.microsoft\.com|teams\.cloud\.microsoft|planner\.cloud\.microsoft|tasks\.office\.com|planner\.microsoft\.com)\//.test(href)) return <span>{texto}</span>;
  return <a className="mc-link" href={href} target="_blank" rel="noopener noreferrer">{texto}<ExternalLink size={12} aria-hidden="true" /></a>;
}

export function ConteudoTeams({ dados, aba, filtro }: { dados: DadosTeams; aba: string; filtro: string }) {
  const mencoes = dados.mensagens.filter((m) => m.mencionaMe && !m.minha);
  const falhas = dados.conversas.filter((c) => c.erro);
  const mensagens = (aba === "mencoes" ? mencoes : dados.mensagens).filter((m) => contem(`${m.autor} ${m.texto} ${m.conversa}`, filtro));
  const conversas = dados.conversas.filter((c) => contem(c.titulo, filtro));
  return <section className="microsoft-conteudo" aria-label="Dados do Microsoft Teams">
    {dados.conta && <p className="mc-conta privado">{dados.conta}</p>}
    {dados.parcial && <AvisoFaixa><span>Consulta parcial: mostrando as conversas mais recentes que puderam ser consultadas. Abra o Teams para conferir o histórico completo.</span></AvisoFaixa>}
    {aba === "visao" && <div className="conexao-metricas">
      <Metrica rotulo="Conversas consultadas" valor={dados.conversas.length} />
      <Metrica rotulo="Mensagens recentes" valor={falhas.length ? `${dados.mensagens.length}+` : dados.mensagens.length} />
      <Metrica rotulo="Menções recentes a você" valor={falhas.length ? `${mencoes.length}+` : mencoes.length} />
    </div>}
    <p className="mc-contexto">Conversas privadas, em grupo e de reuniões da sua conta. As menções se referem às mensagens recentes consultadas.</p>
    {aba === "conversas" ? <>
      {conversas.length === 0 ? <Vazio titulo="Nenhuma conversa encontrada" /> : <ul className="mc-lista">{conversas.map((conversa) => <li className="mc-linha" key={conversa.id}>
        <span className="mc-icone" aria-hidden="true"><MessageSquare size={18} /></span>
        <div className="mc-texto"><strong><LinkMicrosoft href={conversa.link} texto={conversa.titulo} /></strong><small>{conversa.tipo === "meeting" ? "Reunião" : conversa.tipo === "group" ? "Grupo" : "Conversa"}{conversa.atualizadaEm ? ` · ${horarioRelativo(conversa.atualizadaEm)}` : ""}</small>{conversa.erro && <p className="mc-aviso">{mensagemDeErroDaConexao(conversa.erro)}</p>}</div>
      </li>)}</ul>}
    </> : <>
      {falhas.length > 0 && <AvisoFaixa><span>Não foi possível ler as mensagens de {falhas.length} conversa(s). Confira a aba Conversas para ver os detalhes.</span></AvisoFaixa>}
      {mensagens.length === 0 ? <Vazio titulo={aba === "mencoes" ? "Nenhuma menção nas mensagens consultadas" : falhas.length ? "Mensagens indisponíveis nesta consulta" : "Nenhuma mensagem encontrada"} /> : <ul className="mc-lista">{mensagens.slice(0, aba === "visao" ? 12 : 144).map((mensagem) => <li className="mc-linha" key={`${mensagem.conversaId}:${mensagem.id}`}>
        <span className="mc-icone" data-destaque={mensagem.mencionaMe ? "sim" : undefined} aria-hidden="true">{mensagem.mencionaMe ? <AtSign size={18} /> : <MessageSquare size={18} />}</span>
        <div className="mc-texto"><div className="mc-linha-topo"><strong>{mensagem.autor}</strong><time dateTime={mensagem.data}>{horarioRelativo(mensagem.data)}</time></div><small><LinkMicrosoft href={mensagem.link} texto={mensagem.conversa} /></small><p className="privado">{mensagem.texto}</p>{mensagem.mencionaMe && !mensagem.minha && <span className="mc-etiqueta">Mencionou você</span>}{mensagem.importante && <span className="mc-etiqueta">Importante</span>}</div>
      </li>)}</ul>}
    </>}
  </section>;
}

export function ConteudoPlanner({ dados, aba, filtro, agora = new Date() }: { dados: DadosPlanner; aba: string; filtro: string; agora?: Date }) {
  const abertas = dados.tarefas.filter((t) => t.progresso < 100);
  const atrasadas = abertas.filter((t) => tarefaPlannerAtrasada(t, agora));
  const concluidas = dados.tarefas.filter((t) => t.progresso === 100);
  const tarefas = (aba === "concluidas" ? concluidas : aba === "atrasadas" ? atrasadas : abertas).filter((t) => contem(`${t.titulo} ${t.plano}`, filtro));
  return <section className="microsoft-conteudo" aria-label="Dados do Microsoft Planner">
    {dados.conta && <p className="mc-conta privado">{dados.conta}</p>}
    {dados.parcial && <AvisoFaixa><span>Consulta parcial: os números representam as tarefas carregadas. Abra o Planner para conferir a lista completa.</span></AvisoFaixa>}
    {dados.planosIndisponiveis > 0 && <AvisoFaixa><span>As tarefas foram consultadas, mas não foi possível obter o nome de {dados.planosIndisponiveis} plano(s).</span></AvisoFaixa>}
    {aba === "visao" && <div className="conexao-metricas">
      <Metrica rotulo="Em aberto" valor={abertas.length} />
      <Metrica rotulo="Com prazo vencido" valor={atrasadas.length} />
      <Metrica rotulo="Concluídas" valor={concluidas.length} />
    </div>}
    <p className="mc-contexto">Tarefas de planos básicos atribuídas à sua conta de trabalho. Para gerenciar suas tarefas ou consultar planos Premium, abra o Planner.</p>
    {tarefas.length === 0 ? <Vazio titulo={aba === "concluidas" ? "Nenhuma tarefa concluída nesta consulta" : aba === "atrasadas" ? "Nenhuma tarefa com prazo vencido nesta consulta" : "Nenhuma tarefa em aberto nesta consulta"} /> : <ul className="mc-lista">{tarefas.map((tarefa) => <li className="mc-linha" key={tarefa.id}>
      <span className="mc-icone" aria-hidden="true"><ClipboardCheck size={18} /></span>
      <div className="mc-texto"><strong><LinkMicrosoft href={tarefa.link} texto={tarefa.titulo} /></strong><small>{tarefa.plano}</small><div className="mc-prazo" data-vencido={tarefaPlannerAtrasada(tarefa, agora) ? "sim" : undefined}><CalendarDays size={13} aria-hidden="true" />{tarefa.prazo ? <time dateTime={tarefa.prazo}>{formatarData(new Date(tarefa.prazo), "dd/MM/yyyy 'às' HH:mm")}{tarefaPlannerAtrasada(tarefa, agora) ? " · Prazo vencido" : ""}</time> : "Sem prazo definido"}</div><div className="mc-progresso"><progress max={100} value={tarefa.progresso} aria-label={`Andamento: ${tarefa.titulo}`} /><span>{tarefa.progresso === 100 ? "Concluída" : tarefa.progresso > 0 ? `Em andamento · ${tarefa.progresso}%` : "Não iniciada"}</span></div>{tarefa.prioridade <= 3 && <span className="mc-etiqueta">{tarefa.prioridade <= 1 ? "Urgente" : "Prioridade alta"}</span>}</div>
    </li>)}</ul>}
  </section>;
}
