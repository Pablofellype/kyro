import { useState, type FormEvent } from "react";
import { ArrowUpRight, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { Botao, Campo, ConfirmarModal, Vazio } from "../../componentes/basicos";
import { linkDeImportado, useImportados, type DadosFornecedorImportado, type FornecedorImportado, type OpcoesImportados } from "../../estado/importados";
import { useInterface } from "../../estado/interface";

const VAZIO: DadosFornecedorImportado = { nome: "", categoria: "", plataforma: "", link: "" };

export function Fornecedores({ opcoes }: { opcoes: OpcoesImportados }) {
  const fornecedores = useImportados((s) => s.fornecedores);
  const [editor, setEditor] = useState<FornecedorImportado | null | undefined>();
  const [dados, setDados] = useState<DadosFornecedorImportado>(VAZIO);
  const [excluir, setExcluir] = useState<FornecedorImportado | null>(null);
  const [erro, setErro] = useState("");

  function abrir(fornecedor: FornecedorImportado | null) {
    setDados(fornecedor ?? VAZIO);
    setEditor(fornecedor);
    setErro("");
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dados.nome.trim()) return setErro("Informe o nome do fornecedor.");
    if (dados.link.trim() && !linkDeImportado(dados.link)) return setErro("Informe um link começando com http:// ou https://.");
    if (!useImportados.getState().salvarFornecedor(dados, editor?.id)) return setErro("Confira o nome. Ele pode já estar cadastrado.");
    useInterface.getState().avisar(editor ? "Fornecedor atualizado." : "Fornecedor adicionado.", undefined, "sucesso");
    setEditor(undefined);
  }

  return <div className="importados-fornecedores">
    {editor === undefined ? <div className="importados-fornecedores-topo">
      <Botao variante="primario" icone={<Plus size={18} />} onClick={() => abrir(null)}>Novo fornecedor</Botao>
    </div> : <form className="importados-editor importados-painel-editor" onSubmit={salvar}>
      <h2>{editor ? "Editar fornecedor" : "Novo fornecedor"}</h2>
      <Campo id="fornecedor-nome" rotulo="Nome do fornecedor" obrigatorio>
        <input className="campo" id="fornecedor-nome" value={dados.nome} required maxLength={80} onChange={(e) => setDados({ ...dados, nome: e.target.value })} />
      </Campo>
      <div className="importados-editor-grade">
        {(["categoria", "plataforma"] as const).map((campo) => <Campo key={campo} id={`fornecedor-${campo}`} rotulo={campo === "categoria" ? "Categoria" : "Plataforma"}>
          <input className="campo" id={`fornecedor-${campo}`} list={`fornecedor-opcoes-${campo}`} value={dados[campo]} maxLength={80} onChange={(e) => setDados({ ...dados, [campo]: e.target.value })} />
          <datalist id={`fornecedor-opcoes-${campo}`}>{opcoes[campo].map((opcao) => <option key={opcao} value={opcao} />)}</datalist>
        </Campo>)}
      </div>
      <Campo id="fornecedor-link" rotulo="Link direto do fornecedor">
        <input className="campo" id="fornecedor-link" type="url" inputMode="url" value={dados.link} maxLength={2048} placeholder="https://" onChange={(e) => setDados({ ...dados, link: e.target.value })} />
      </Campo>
      {erro && <p className="campo-erro" role="alert">{erro}</p>}
      <div className="formulario-acoes"><Botao onClick={() => setEditor(undefined)}>Cancelar</Botao><Botao type="submit" variante="primario">Salvar fornecedor</Botao></div>
    </form>}
    {fornecedores.length ? <ul className="importados-grade">
      {fornecedores.map((fornecedor) => <li className="importados-produto importados-fornecedor" key={fornecedor.id}>
        <div className="importados-fornecedor-corpo">
          {fornecedor.categoria && <span className="importados-categoria">{fornecedor.categoria}</span>}
          <h2>{fornecedor.nome}</h2>
          {fornecedor.plataforma && <p className="texto-2">{fornecedor.plataforma}</p>}
          <div className="importados-produto-acoes">
            {fornecedor.link && <a className="importados-link-botao" href={fornecedor.link} target="_blank" rel="noopener noreferrer">Abrir fornecedor <ArrowUpRight size={15} /></a>}
            <Botao soIcone icone={<Pencil size={16} />} aria-label={`Editar ${fornecedor.nome}`} onClick={() => abrir(fornecedor)} />
            <Botao soIcone variante="fantasma" icone={<Trash2 size={16} />} aria-label={`Excluir ${fornecedor.nome}`} onClick={() => setExcluir(fornecedor)} />
          </div>
        </div>
      </li>)}
    </ul> : editor === undefined && <Vazio icone={<Store size={30} />} titulo="Nenhum fornecedor cadastrado" />}
    {excluir && <ConfirmarModal aberto titulo="Excluir fornecedor" texto={`Excluir ${excluir.nome} do cadastro de fornecedores?`} aoConfirmar={() => useImportados.getState().excluirFornecedor(excluir.id)} aoFechar={() => setExcluir(null)} />}
  </div>;
}
