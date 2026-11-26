import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarPlus, ClipboardPenLine, ListPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { CaixaDeEscolha } from "../../componentes/CaixaDeEscolha";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { TIPOS_REGISTRO_OPERACAO, useOrganizacao, type RegistroOperacao } from "../../estado/organizacao";
import { tarefaPendente, useRotina } from "../../estado/rotina";
import type { Prioridade, Tarefa } from "../../tipos";
import { dataValida, formatar, horaValida } from "../../utilitarios/datas";

const TIPOS = {
  atividade: { novo: "Nova atividade", icone: ListPlus },
  compromisso: { novo: "Novo compromisso", icone: CalendarPlus },
  registro: { novo: "Novo registro", icone: Plus },
} as const;
const CATEGORIAS = Object.entries(TIPOS_REGISTRO_OPERACAO).map(([valor, rotulo]) => ({ valor, rotulo }));
const PRIORIDADES = [{ valor: "baixa", rotulo: "Baixa" }, { valor: "media", rotulo: "Média" }, { valor: "alta", rotulo: "Alta" }];
type TipoCadastro = keyof typeof TIPOS;
type Cadastro = { tipo: TipoCadastro; registro?: RegistroOperacao; atividade?: Tarefa };

function podeRegistrar(usuarioId: number) {
  const { usuario } = useAuth.getState();
  return usuario?.id === usuarioId && (usuario.perfil === "dono" || usuario.perfil === "gerencia") && useInterface.getState().area === "empresa";
}

function FormularioRegistro({ tipo, registro, atividade, hoje, usuarioId, aoFechar, aoSalvar }: {
  tipo: TipoCadastro;
  registro?: RegistroOperacao;
  atividade?: Tarefa;
  hoje: string;
  usuarioId: number;
  aoFechar: () => void;
  aoSalvar: (mensagem: string) => void;
}) {
  const [titulo, setTitulo] = useState(registro?.titulo ?? atividade?.titulo ?? "");
  const [data, setData] = useState(atividade ? atividade.data ?? "" : registro?.data ?? hoje);
  const [hora, setHora] = useState(atividade?.hora ?? "");
  const [detalhes, setDetalhes] = useState(registro?.detalhes ?? atividade?.descricao ?? "");
  const [categoria, setCategoria] = useState<RegistroOperacao["tipo"]>(registro?.tipo ?? "aviso");
  const [prioridade, setPrioridade] = useState<Prioridade>(atividade?.prioridade ?? "media");
  const [erro, setErro] = useState("");
  const campoTitulo = useRef<HTMLInputElement>(null);

  useEffect(() => { campoTitulo.current?.focus(); }, []);

  const salvar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!podeRegistrar(usuarioId)) {
      setErro("Sua sessão mudou. Abra o painel novamente para salvar.");
      return;
    }
    if (!titulo.trim() || (data ? !dataValida(data) : tipo !== "atividade") || (hora && (!data || !horaValida(hora)))) {
      setErro("Informe um título e confira a data e o horário.");
      return;
    }
    if (tipo === "atividade") {
      const rotina = useRotina.getState();
      const dados = { titulo: titulo.trim(), data: data || undefined, hora: hora || undefined, descricao: detalhes.trim(), prioridade };
      if (atividade) {
        const atual = rotina.tarefas.find((tarefa) => tarefa.id === atividade.id && tarefa.area === "empresa" && tarefaPendente(tarefa));
        if (!atual) {
          setErro("A atividade não está mais disponível para edição.");
          return;
        }
        rotina.atualizarTarefa(atual.id, dados);
      } else {
        rotina.criarTarefa({ ...dados, area: "empresa" });
      }
      aoSalvar(atividade ? "Atividade atualizada." : "Atividade adicionada.");
      return;
    }
    if (tipo === "compromisso") {
      useOrganizacao.getState().criarEvento({ titulo, data, hora: hora || undefined, area: "empresa", tipo: "evento", repeticao: "nenhuma" });
      aoSalvar("Compromisso adicionado à agenda da empresa.");
      return;
    }
    const salvo = useOrganizacao.getState().salvarRegistroOperacao({ titulo, detalhes, data, tipo: categoria }, registro?.id);
    if (!salvo) {
      setErro("O registro não está mais disponível para edição.");
      return;
    }
    aoSalvar(registro ? "Registro atualizado." : "Registro adicionado.");
  };

  return <form className="ee-formulario-registro" onSubmit={salvar} aria-labelledby="ee-formulario-titulo">
    <h3 id="ee-formulario-titulo">{atividade ? "Editar atividade" : registro ? "Editar registro" : TIPOS[tipo].novo}</h3>
    <label className="ee-campo ee-campo-inteiro">Título<input ref={campoTitulo} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={tipo === "atividade" ? 200 : 120} required /></label>
    <label className="ee-campo">{tipo === "atividade" ? "Prazo (opcional)" : "Data"}<input type="date" value={data} onChange={(e) => { setData(e.target.value); if (!e.target.value) setHora(""); }} required={tipo !== "atividade"} /></label>
    {tipo !== "registro" && <label className="ee-campo">Horário (opcional)<input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={!data} /></label>}
    {tipo === "atividade" && <div className="ee-campo">
      <span>Prioridade</span>
      <CaixaDeEscolha opcoes={PRIORIDADES} valor={prioridade} aoMudar={(valor) => setPrioridade(valor as Prioridade)} placeholder="Escolher prioridade" rotuloAcessivel="Prioridade" textoDaBusca="Buscar prioridade" textoSemResultado="Nenhuma prioridade encontrada" />
    </div>}
    {tipo === "registro" && <div className="ee-campo">
      <span>Categoria</span>
      <CaixaDeEscolha opcoes={CATEGORIAS} valor={categoria} aoMudar={(valor) => setCategoria(valor as RegistroOperacao["tipo"])} placeholder="Escolher categoria" rotuloAcessivel="Categoria" textoDaBusca="Buscar categoria" textoSemResultado="Nenhuma categoria encontrada" />
    </div>}
    {tipo !== "compromisso" && <label className="ee-campo ee-campo-inteiro">Detalhes (opcional)<textarea rows={3} maxLength={600} value={detalhes} onChange={(e) => setDetalhes(e.target.value)} /></label>}
    {erro && <p className="ee-campo-inteiro ee-erro-registro" role="alert">{erro}</p>}
    <div className="ee-rodape-formulario ee-campo-inteiro">
      <button type="button" className="ee-botao" onClick={aoFechar}>Cancelar</button>
      <button type="submit" className="ee-botao ee-botao-principal">Salvar {tipo}</button>
    </div>
  </form>;
}

export function RegistrosDoEscritorio({ hoje, usuarioId, atividadeEmEdicao, aoCancelarEdicao, aoCriarAtividade }: {
  hoje: string;
  usuarioId: number;
  atividadeEmEdicao: Tarefa | null;
  aoCancelarEdicao: () => void;
  aoCriarAtividade: () => void;
}) {
  const registros = useOrganizacao((s) => s.registrosOperacao);
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [remover, setRemover] = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const avisar = useInterface((s) => s.avisar);
  const ordenados = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  const exibidos = mostrarTodos ? ordenados : ordenados.slice(0, 4);
  const formulario: Cadastro | null = atividadeEmEdicao ? { tipo: "atividade", atividade: atividadeEmEdicao } : cadastro;
  const abrirCadastro = (tipo: TipoCadastro, registro?: RegistroOperacao) => {
    aoCancelarEdicao();
    setRemover(null);
    setCadastro({ tipo, registro });
  };
  const fecharFormulario = () => {
    aoCancelarEdicao();
    setCadastro(null);
  };

  const excluirRegistro = (id: string) => {
    if (!podeRegistrar(usuarioId)) return;
    useOrganizacao.getState().excluirRegistroOperacao(id);
    if (cadastro?.registro?.id === id) setCadastro(null);
    setRemover(null);
    avisar("Registro excluído.", undefined, "sucesso");
  };

  return <section className="ee-cartao ee-registros" aria-labelledby="ee-registros-titulo">
    <header className="ee-cabecalho-secao">
      <h2 id="ee-registros-titulo">Registros da operação</h2><ClipboardPenLine size={20} aria-hidden="true" />
    </header>
    <div className="ee-acoes-registros">
      {Object.entries(TIPOS).map(([chave, { novo, icone: Icone }]) => <button type="button" key={chave} className={`ee-botao${chave === "registro" ? " ee-botao-principal" : ""}`} onClick={() => abrirCadastro(chave as TipoCadastro)}>
        <Icone size={16} aria-hidden="true" />{novo}
      </button>)}
    </div>
    {formulario && <FormularioRegistro key={formulario.registro?.id ?? formulario.atividade?.id ?? formulario.tipo} {...formulario} hoje={hoje} usuarioId={usuarioId} aoFechar={fecharFormulario} aoSalvar={(mensagem) => {
      if (formulario.tipo === "atividade" && !formulario.atividade) aoCriarAtividade();
      fecharFormulario();
      avisar(mensagem, undefined, "sucesso");
    }} />}
    {exibidos.length === 0
      ? <p className="ee-nota-vazia">Registre avisos, ocorrências e atualizações do setor.</p>
      : <ul className="ee-lista-registros" id="ee-lista-registros">
        {exibidos.map((registro) => <li key={registro.id}>
          <div className="ee-registro-texto">
            <div className="ee-registro-meta"><span className="ee-badge" data-tom={registro.tipo === "ocorrencia" ? "areia" : "verde"}>{TIPOS_REGISTRO_OPERACAO[registro.tipo]}</span><time dateTime={registro.data}>{formatar(registro.data, "dd/MM/yyyy")}</time></div>
            <h3>{registro.titulo}</h3>
            {registro.detalhes && <p>{registro.detalhes}</p>}
          </div>
          {remover === registro.id
            ? <div className="ee-acoes-registro">
              <button type="button" className="ee-botao" onClick={() => setRemover(null)}>Cancelar</button>
              <button type="button" className="ee-botao" onClick={() => excluirRegistro(registro.id)} aria-label={`Confirmar exclusão de ${registro.titulo}`}>Confirmar exclusão</button>
            </div>
            : <div className="ee-acoes-registro">
              <button type="button" className="ee-botao" aria-label={`Editar ${registro.titulo}`} onClick={() => abrirCadastro("registro", registro)}><Pencil size={14} aria-hidden="true" /></button>
              <button type="button" className="ee-botao" aria-label={`Excluir ${registro.titulo}`} onClick={() => setRemover(registro.id)}><Trash2 size={14} aria-hidden="true" /></button>
            </div>}
        </li>)}
      </ul>}
    {registros.length > 4 && <button type="button" className="ee-link" aria-expanded={mostrarTodos} aria-controls="ee-lista-registros" onClick={() => setMostrarTodos((valor) => !valor)}>
      {mostrarTodos ? "Mostrar menos" : `Ver todos os ${registros.length} registros`}
    </button>}
  </section>;
}
