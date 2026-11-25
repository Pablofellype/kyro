import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, CalendarDays, ChartNoAxesCombined, Check, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, Clock3, FileSpreadsheet, History, ListTodo, MessageSquare, PackageOpen, Pencil, RefreshCw, Settings2, Users, type LucideIcon } from "lucide-react";
import { useAuth, type UsuarioAutenticado } from "../../estado/autenticacao";
import { useConfig } from "../../estado/configuracoes";
import { useInterface } from "../../estado/interface";
import { useOrganizacao } from "../../estado/organizacao";
import { tarefaPendente, useRotina } from "../../estado/rotina";
import { useWhatsapp } from "../../estado/whatsapp";
import { dataValida, formatar, formatarData, saudacao } from "../../utilitarios/datas";
import type { Rota, Tarefa } from "../../tipos";
import { itensDoMenuAppsEmpresa } from "./aplicativosEmpresaConfig";
import { useCatalogoAppsEmpresa } from "./catalogoAppsEmpresa";
import { resumirPainelEmpresa, type DadosRemotosDoPainel, type PrioridadeDoPainel, type ResumoDoPainelEmpresa } from "./dadosDoPainelEmpresa";
import { usarDadosDoPainelEmpresa, type RotinasDoPainel } from "./usarDadosDoPainelEmpresa";
import { RegistrosDoEscritorio } from "./RegistrosDoEscritorio";
import "./painelEmpresa.css";

interface PropsPainel {
  nome: string;
  usuarioId?: number;
  usuario: Pick<UsuarioAutenticado, "perfil" | "roboAderencias" | "nome">;
  agora: Date;
  resumo: ResumoDoPainelEmpresa;
  remoto: DadosRemotosDoPainel & { carregando: boolean; atualizadoEm: Date | null; aderencias?: RotinasDoPainel };
  mensagens: number | null;
  whatsappComErro: boolean;
  aoNavegar: (rota: Rota, parametros?: Record<string, string>) => void;
  aoAtualizar: () => void;
  aoConcluir: (id: string) => void;
}

function Metrica({ icone: Icone, titulo, valor, detalhe, tom, aoClicar }: { icone: LucideIcon; titulo: string; valor: number | null; detalhe: string; tom: string; aoClicar: () => void }) {
  return <button type="button" className="ee-metrica" data-tom={tom} onClick={aoClicar}>
    <span className="ee-icone" aria-hidden="true"><Icone size={20} /></span>
    <span className="ee-metrica-texto"><span>{titulo}</span><strong>{valor ?? "—"}</strong><small>{detalhe}</small></span>
    <ArrowUpRight size={16} className="ee-metrica-seta" aria-hidden="true" />
  </button>;
}

function Vazio({ icone: Icone, titulo, texto }: { icone: LucideIcon; titulo: string; texto: string }) {
  return <div className="ee-vazio"><span aria-hidden="true"><Icone size={23} /></span><strong>{titulo}</strong><p>{texto}</p></div>;
}

function PrazoDaTarefa({ item, hoje }: { item: Extract<PrioridadeDoPainel, { tipo: "tarefa" }>; hoje: string }) {
  const { tarefa } = item;
  return <span>{tarefa.data === hoje ? "Hoje" : dataValida(tarefa.data) ? formatar(tarefa.data!, "dd/MM") : "Sem prazo definido"}{tarefa.hora ? ` às ${tarefa.hora}` : ""}{tarefa.prioridade === "alta" ? " · Prioridade alta" : ""}</span>;
}

const SISTEMAS_PRINCIPAIS = ["registros-limpeza", "calendario-limpeza", "materiais", "requisicoes"];
const ICONES_SISTEMAS: Record<string, LucideIcon> = { "registros-limpeza": ClipboardCheck, "calendario-limpeza": CalendarDays, materiais: PackageOpen, requisicoes: ClipboardList };
const FILTROS_ATIVIDADES = [{ id: "todas", nome: "Todas" }, { id: "hoje", nome: "Para hoje" }, { id: "vencidas", nome: "Vencidas" }] as const;
type FiltroAtividades = typeof FILTROS_ATIVIDADES[number]["id"];

function ResumoDasAderencias({ dados, aoAbrir }: { dados: RotinasDoPainel; aoAbrir: () => void }) {
  const rotinas = dados.situacao === "prontas" ? dados.rotinas : [];
  const ativos = rotinas.filter((rotina) => rotina.ativo && rotina.frequencia !== "manual").length;
  const ultimasExecucoes = rotinas.flatMap((rotina) => {
    const resultado = rotina.ultimoResultado;
    const data = resultado ? new Date(resultado.executadoEm) : null;
    return resultado && data && Number.isFinite(data.getTime()) ? [{ rotina, resultado, data }] : [];
  }).sort((a, b) => b.data.getTime() - a.data.getTime()).slice(0, 3);

  return <section className="ee-cartao ee-aderencias-painel" aria-labelledby="ee-aderencias-titulo">
    <header className="ee-cabecalho-secao">
      <h2 id="ee-aderencias-titulo">Robô de Aderências</h2>
      <FileSpreadsheet size={18} aria-hidden="true" />
    </header>
    {dados.situacao === "carregando" && <p className="ee-nota-vazia">Consultando rotinas…</p>}
    {dados.situacao === "erro" && <p className="ee-nota-vazia">Não foi possível consultar as rotinas agora.</p>}
    {dados.situacao === "prontas" && (rotinas.length === 0
      ? <p className="ee-nota-vazia">Nenhuma rotina configurada.</p>
      : <>
        <dl className="ee-contadores-rotinas">
          <div><dt>Rotinas configuradas</dt><dd>{rotinas.length}</dd></div>
          <div><dt>Agendamentos ativos</dt><dd>{ativos}</dd></div>
        </dl>
        {ultimasExecucoes.length ? <ul className="ee-historico-lista">
          {ultimasExecucoes.map(({ rotina, resultado, data }) => <li key={rotina.id}>
            <span className="ee-historico-icone" aria-hidden="true"><FileSpreadsheet size={14} /></span>
            <div>
              <strong>{rotina.nome}</strong>
              <span>{resultado.planilhasEnviadas} {resultado.planilhasEnviadas === 1 ? "print enviado" : "prints enviados"}
                {resultado.erros.length > 0 && ` · ${resultado.erros.length} ${resultado.erros.length === 1 ? "falha" : "falhas"}`}</span>
            </div>
            <time dateTime={data.toISOString()}>{formatarData(data, "dd/MM · HH:mm")}</time>
          </li>)}
        </ul> : <p className="ee-nota-vazia">Nenhum resultado registrado.</p>}
      </>)}
    <button type="button" className="ee-link" onClick={aoAbrir}>Abrir rotinas <ArrowUpRight size={13} aria-hidden="true" /></button>
  </section>;
}

export function VisaoDoEscritorio({ nome, usuarioId, usuario, agora, resumo, remoto, mensagens, whatsappComErro, aoNavegar, aoAtualizar, aoConcluir }: PropsPainel) {
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [filtro, setFiltro] = useState<FiltroAtividades>("todas");
  const [atividadeEmEdicao, setAtividadeEmEdicao] = useState<Tarefa | null>(null);
  const dono = usuario.perfil === "dono";
  const primeiroNome = nome.trim().split(/\s+/)[0] || usuario.nome.trim().split(/\s+/)[0];
  const contagem = { todas: resumo.abertas.length, hoje: resumo.paraHoje.length, vencidas: resumo.atrasadas.length };
  const prioridades = resumo.prioridades.filter((item) => filtro === "todas" || (filtro === "hoje" ? item.tarefa.data === resumo.hoje : item.atrasada));
  const exibidas = mostrarTodas ? prioridades : prioridades.slice(0, 5);
  const { aplicativos } = useCatalogoAppsEmpresa();
  const sistemas = SISTEMAS_PRINCIPAIS.flatMap((id) => aplicativos.find((app) => app.id === id) ?? []);
  const outrosAcessos = itensDoMenuAppsEmpresa(usuario, aplicativos).filter((item) => !SISTEMAS_PRINCIPAIS.includes(item.id));
  const membrosAtivos = remoto.membros?.filter((membro) => membro.ativo && membro.perfil !== "visitante") ?? null;
  const mostrarFiltro = (proximo: FiltroAtividades) => {
    setFiltro(proximo);
    setMostrarTodas(false);
  };
  const abrirAtividades = (proximo: FiltroAtividades) => {
    mostrarFiltro(proximo);
    document.getElementById("ee-prioridades-titulo")?.scrollIntoView({ block: "start" });
  };

  return <div className="escritorio-empresa">
    <header className="ee-abertura">
      <div><span className="ee-contexto"><Building2 size={14} aria-hidden="true" />{dono ? "Escritório da empresa" : "Painel da gerência"}</span>
        <h1>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}!</h1>
      </div>
      <div className="ee-abertura-acoes">
        <time dateTime={agora.toISOString()}><CalendarDays size={14} aria-hidden="true" />{formatar(resumo.hoje, "EEEE, d 'de' MMMM")}</time>
        <div className="ee-acoes-do-painel">
          <button type="button" className="ee-botao ee-botao-discreto" onClick={() => aoNavegar("powerBi")}><ChartNoAxesCombined size={14} aria-hidden="true" />Power BI</button>
          <button type="button" className="ee-botao ee-botao-discreto" onClick={aoAtualizar} disabled={remoto.carregando} aria-label="Atualizar dados do escritório"><RefreshCw size={14} className={remoto.carregando ? "girando" : ""} aria-hidden="true" />{remoto.carregando ? "Atualizando" : "Atualizar"}</button>
        </div>
      </div>
    </header>

    <section className="ee-resumo" aria-label="Resumo do trabalho">
      <Metrica icone={ListTodo} titulo="Atividades abertas" valor={contagem.todas} detalhe={`${contagem.hoje} para hoje · ${resumo.concluidasNaSemana} concluídas nesta semana`} tom="verde" aoClicar={() => abrirAtividades("todas")} />
      <Metrica icone={Clock3} titulo="Atividades vencidas" valor={contagem.vencidas} detalhe="Ver atividades com prazo vencido" tom="areia" aoClicar={() => abrirAtividades("vencidas")} />
      <Metrica icone={CalendarDays} titulo="Compromissos restantes hoje" valor={resumo.agendaHoje} detalhe="Ver agenda da empresa" tom="verde" aoClicar={() => aoNavegar("calendario", { data: resumo.hoje })} />
      <Metrica icone={MessageSquare} titulo="Mensagens não lidas" valor={mensagens} detalhe={whatsappComErro ? "Não foi possível atualizar o WhatsApp" : mensagens === null ? "Abra para conferir a conexão" : "Abrir WhatsApp"} tom="azul" aoClicar={() => aoNavegar("whatsapp")} />
    </section>

    {usuarioId !== undefined && <RegistrosDoEscritorio hoje={resumo.hoje} usuarioId={usuarioId} atividadeEmEdicao={atividadeEmEdicao} aoCancelarEdicao={() => setAtividadeEmEdicao(null)} aoCriarAtividade={() => mostrarFiltro("todas")} />}

    <div className="ee-grade-principal">
      <section className="ee-cartao ee-prioridades" aria-labelledby="ee-prioridades-titulo">
        <header className="ee-cabecalho-secao"><h2 id="ee-prioridades-titulo">Precisa da sua atenção</h2></header>
        <div className="ee-filtros" role="group" aria-label="Filtrar atividades">
          {FILTROS_ATIVIDADES.map(({ id, nome }) => <button type="button" key={id} aria-pressed={id === filtro} onClick={() => mostrarFiltro(id)}>{nome} <span>{contagem[id]}</span></button>)}
        </div>
        <ul className="ee-lista-prioridades" id="ee-lista-prioridades">
          {exibidas.map((item) => <li className="ee-prioridade" key={`tarefa-${item.tarefa.id}`}>
            <span className="ee-icone" data-tom={item.atrasada ? "areia" : "verde"} aria-hidden="true"><ListTodo size={18} /></span>
            <div className="ee-prioridade-texto"><span className="ee-badge" data-tom={item.atrasada ? "areia" : "verde"}>{item.atrasada ? "Prazo vencido" : "Atividade da empresa"}</span><h3>{item.tarefa.titulo}</h3>{item.tarefa.descricao && <p>{item.tarefa.descricao}</p>}<small><PrazoDaTarefa item={item} hoje={resumo.hoje} /></small></div>
            <div className="ee-acoes-atividade">
              {usuarioId !== undefined && <button type="button" className="ee-acao-linha" onClick={() => setAtividadeEmEdicao(item.tarefa)} aria-label={`Editar atividade: ${item.tarefa.titulo}`}><Pencil size={14} aria-hidden="true" /></button>}
              <button type="button" className="ee-acao-linha" onClick={() => aoConcluir(item.tarefa.id)} aria-label={`Concluir atividade: ${item.tarefa.titulo}`}><Check size={14} aria-hidden="true" /> Concluir</button>
            </div>
          </li>)}
        </ul>
        {exibidas.length === 0 && <Vazio icone={CheckCircle2} titulo={filtro === "todas" ? "Nenhuma atividade pendente neste resumo" : filtro === "hoje" ? "Nenhuma atividade pendente para hoje" : "Nenhuma atividade vencida"} texto="Confira as outras atividades ou a agenda da empresa." />}
        {prioridades.length > 5 && <div className="ee-rodape-secao"><button type="button" className="ee-link" onClick={() => setMostrarTodas((valor) => !valor)} aria-expanded={mostrarTodas} aria-controls="ee-lista-prioridades">{mostrarTodas ? "Mostrar menos" : `Ver mais ${prioridades.length - 5}`}<ChevronDown size={14} aria-hidden="true" /></button></div>}
      </section>

      <div className="ee-coluna-lateral">
        <section className="ee-cartao ee-agenda" aria-labelledby="ee-agenda-titulo">
          <header className="ee-cabecalho-secao"><div><span className="ee-sobretitulo">Hoje e próximos dias</span><h2 id="ee-agenda-titulo">Na sua agenda</h2></div><CalendarDays size={20} aria-hidden="true" /></header>
          {resumo.agenda.length === 0 ? <Vazio icone={CalendarDays} titulo="Agenda livre neste período" texto="Nenhum compromisso futuro registrado nos próximos 30 dias." /> : <ol className="ee-agenda-lista">
            {resumo.agenda.slice(0, 4).map((evento, indice) => <li key={evento.id}><button type="button" className={`ee-compromisso${indice === 0 ? " ee-proximo" : ""}`} onClick={() => aoNavegar("calendario", { data: evento.data })}>
              {indice === 0 && <span className="ee-proximo-rotulo">Próximo compromisso</span>}
              <span className="ee-compromisso-quando"><strong>{evento.hora || "Dia todo"}</strong><span>{evento.data === resumo.hoje ? "Hoje" : formatar(evento.data, "EEE, dd/MM")}</span></span>
              <h3>{evento.titulo}</h3><span className="ee-compromisso-tipo">{evento.tipo === "lembrete" ? "Lembrete" : "Compromisso"}<ArrowUpRight size={13} aria-hidden="true" /></span>
            </button></li>)}
          </ol>}
          <button type="button" className="ee-botao ee-botao-principal" onClick={() => aoNavegar("calendario", { data: resumo.hoje })}>Abrir agenda da empresa <ArrowRight size={15} aria-hidden="true" /></button>
        </section>
        {remoto.aderencias && <ResumoDasAderencias dados={remoto.aderencias} aoAbrir={() => aoNavegar("appsEmpresa", { app: "aderencias" })} />}
      </div>
    </div>

    <section className="ee-sistemas" aria-labelledby="ee-sistemas-titulo">
      <header className="ee-cabecalho-secao"><h2 id="ee-sistemas-titulo">Seus sistemas</h2></header>
      <div className="ee-sistemas-grade">{sistemas.map((app) => {
        const Icone = ICONES_SISTEMAS[app.id];
        const disponivel = app.status === "disponivel" && Boolean(app.url);
        return <button type="button" className="ee-sistema" data-sistema={app.id} key={app.id} disabled={!disponivel} onClick={() => aoNavegar("appsEmpresa", { app: app.id })}>
          <span className="ee-icone" aria-hidden="true"><Icone size={22} /></span><strong>{app.nome}</strong><span className="ee-sistema-descricao">{app.descricao}</span><span className="ee-sistema-abrir">{disponivel ? "Acessar sistema" : "Em manutenção"}<ArrowUpRight size={15} aria-hidden="true" /></span>
        </button>;
      })}</div>
      <div className="ee-outros-acessos"><span>Outros acessos</span>{outrosAcessos.map((item) => <button type="button" className="ee-link" key={item.id} disabled={!item.disponivel} onClick={() => aoNavegar("appsEmpresa", { app: item.id })}>{item.nome}{item.disponivel ? <ArrowUpRight size={13} aria-hidden="true" /> : <small>Em manutenção</small>}</button>)}</div>
    </section>

    <div className="ee-grade-secundaria">
      <section className="ee-cartao ee-historico" aria-labelledby="ee-historico-titulo"><header className="ee-cabecalho-secao"><div><span className="ee-sobretitulo">Movimentação de trabalho</span><h2 id="ee-historico-titulo">Últimos registros</h2></div><History size={18} aria-hidden="true" /></header>
        {resumo.historico.length === 0 ? <p className="ee-nota-vazia">Atividades concluídas aparecerão aqui.</p> : <ul className="ee-historico-lista">{resumo.historico.map((registro) => <li key={registro.id}><span className="ee-historico-icone" aria-hidden="true"><CheckCircle2 size={15} /></span><div><strong>{registro.titulo}</strong><span>{registro.detalhe}</span></div><time dateTime={registro.data}>{formatarData(new Date(registro.data), "dd/MM · HH:mm")}</time></li>)}</ul>}
      </section>

      <section className="ee-cartao ee-equipe" aria-labelledby="ee-equipe-titulo"><header className="ee-cabecalho-secao"><div><span className="ee-sobretitulo">{dono ? "Pessoas e acessos" : "Seu espaço de trabalho"}</span><h2 id="ee-equipe-titulo">{dono ? "Equipe cadastrada" : "Seu acesso de gerência"}</h2></div><Users size={18} aria-hidden="true" /></header>
        {dono ? <>
          {membrosAtivos === null ? <p className="ee-nota-vazia">{remoto.erroMembros ? "Não foi possível consultar a equipe agora." : "Consultando as contas da empresa…"}</p> : membrosAtivos.length === 0 ? <p className="ee-nota-vazia">Nenhuma conta ativa nesta consulta.</p> : <ul className="ee-equipe-lista">{membrosAtivos.slice(0, 4).map((membro) => <li key={membro.id}><span className="ee-avatar" aria-hidden="true">{membro.nome.slice(0, 1).toUpperCase()}</span><div><strong>{membro.nome}</strong><span>{membro.setor || membro.cargo || (membro.perfil === "dono" ? "Dono" : "Gerência")}</span></div><small>Conta ativa</small></li>)}</ul>}
          <button type="button" className="ee-link" onClick={() => aoNavegar("configuracoes", { secao: "admin" })}>Gerenciar acessos <ArrowUpRight size={13} aria-hidden="true" /></button>
        </> : <><div className="ee-identidade"><span className="ee-avatar" aria-hidden="true">{(nome || usuario.nome).trim().slice(0, 1).toUpperCase()}</span><div><strong>{nome || usuario.nome}</strong><span>Gerência da empresa</span></div></div><p className="ee-nota-vazia">Agenda e ferramentas de trabalho reunidas para facilitar sua rotina.</p></>}
      </section>
    </div>

    <footer className="ee-rodape"><span>{remoto.atualizadoEm ? `Dados atualizados às ${formatarData(remoto.atualizadoEm, "HH:mm")}` : "Escritório da empresa"}</span><button type="button" className="ee-link" onClick={() => aoNavegar("configuracoes", { secao: "aparencia" })}><Settings2 size={14} aria-hidden="true" /> Personalizar meu espaço</button></footer>
  </div>;
}

export function concluirAtividadeDoPainel(id: string, usuarioId: number) {
  const temAcesso = () => {
    const usuarioAtual = useAuth.getState().usuario;
    return usuarioAtual?.id === usuarioId && (usuarioAtual.perfil === "dono" || usuarioAtual.perfil === "gerencia");
  };
  if (!temAcesso() || useInterface.getState().area !== "empresa") return;
  const tarefa = useRotina.getState().tarefas.find((item) => item.id === id && item.area === "empresa" && tarefaPendente(item));
  if (!tarefa) return;
  useRotina.getState().mudarStatus(id, "concluida");
  const concluidaEm = useRotina.getState().tarefas.find((item) => item.id === id)?.concluidaEm;
  useInterface.getState().avisar("Atividade concluída.", () => {
    if (!temAcesso()) return;
    const atual = useRotina.getState().tarefas.find((item) => item.id === id);
    if (atual?.area === "empresa" && atual.status === "concluida" && atual.concluidaEm === concluidaEm) useRotina.getState().mudarStatus(id, tarefa.status);
  }, "sucesso");
}

export function PainelCoordenacao() {
  const usuario = useAuth((estado) => estado.usuario);
  const token = useAuth((estado) => estado.token);
  const area = useInterface((estado) => estado.area);
  const irPara = useInterface((estado) => estado.irPara);
  const nomePreferido = useConfig((estado) => estado.nome);
  const eventos = useOrganizacao((estado) => estado.eventos);
  const tarefas = useRotina((estado) => estado.tarefas);
  const whatsapp = useWhatsapp((estado) => estado.estado);
  const whatsappComErro = useWhatsapp((estado) => estado.falhou);
  const carregarWhatsapp = useWhatsapp((estado) => estado.carregar);
  const ativo = area === "empresa" && Boolean(usuario && usuario.perfil !== "visitante");
  const remoto = usarDadosDoPainelEmpresa(ativo);
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!ativo) return;
    if (token) void carregarWhatsapp();
    const intervalo = window.setInterval(() => setAgora(new Date()), 60000);
    return () => window.clearInterval(intervalo);
  }, [ativo, usuario?.id, token, carregarWhatsapp]);
  const resumo = useMemo(() => resumirPainelEmpresa(eventos, tarefas, agora), [eventos, tarefas, agora]);
  if (!ativo || !usuario) return null;

  const mensagens = !whatsappComErro && whatsapp?.ligado && whatsapp.vinculo === "conectado" ? whatsapp.naoLidas : null;
  const atualizar = () => {
    remoto.atualizar();
    if (token) void carregarWhatsapp();
  };
  return <VisaoDoEscritorio key={usuario.id} nome={nomePreferido.trim() || usuario.nome} usuarioId={usuario.id} usuario={usuario} agora={agora} resumo={resumo} remoto={remoto} mensagens={mensagens} whatsappComErro={whatsappComErro} aoNavegar={irPara} aoAtualizar={atualizar} aoConcluir={(id) => concluirAtividadeDoPainel(id, usuario.id)} />;
}
