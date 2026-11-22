import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, ImagePlus, PackageSearch, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Botao, Campo, ConfirmarModal, Modal, Vazio } from "../../componentes/basicos";
import {
  CAMPOS_IMPORTADOS, CHAVE_IMPORTADOS, MOEDAS_IMPORTADOS, filtrarImportados, linkDeImportado, listarOpcoesImportados, useImportados,
  type CampoImportado, type DadosProdutoImportado, type MoedaImportada, type OpcoesImportados, type ProdutoImportado,
} from "../../estado/importados";
import { useInterface } from "../../estado/interface";
import { aoMudarDeFora } from "../../ponte/armazenamento";
import { NATIVO } from "../../desktop/desktop";
import { otimizarImagem } from "../../servicos/fotos";
import { centavosParaCampo, lerValorEmCentavos } from "../../utilitarios/dinheiro";
import "./importados.css";

const ROTULOS: Record<CampoImportado, string> = { categoria: "Categoria", plataforma: "Plataforma", fornecedor: "Fornecedor", origem: "Origem" };
const MOEDAS: Record<MoedaImportada, string> = { BRL: "Real (BRL)", USD: "Dólar (USD)", CNY: "Yuan (CNY)", EUR: "Euro (EUR)" };
const formatadores = Object.fromEntries(MOEDAS_IMPORTADOS.map((moeda) => [moeda, new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda })]));
const OPCOES_VAZIAS = { categoria: "", plataforma: "", fornecedor: "", origem: "" };
const PRODUTO_VAZIO: DadosProdutoImportado = { ...OPCOES_VAZIAS, nome: "", link: "", foto: "", preco: null, moeda: "BRL", nota: "" };
const FILTROS_INICIAIS = { ...OPCOES_VAZIAS, busca: "", moeda: "" as MoedaImportada | "", minimo: "", maximo: "", ordem: "recentes" };

function campoPreco(texto: string) {
  const valor = lerValorEmCentavos(texto);
  return valor !== null && valor >= 0 ? valor : null;
}

function SeletorDeOpcao({ campo, opcoes, valor, aoMudar }: {
  campo: CampoImportado; opcoes: string[]; valor: string; aoMudar: (valor: string) => void;
}) {
  const [criando, setCriando] = useState(false);
  const id = `importado-${campo}`;
  return (
    <div className="importados-escolha">
      <Campo id={id} rotulo={criando ? `${ROTULOS[campo]} para cadastrar` : ROTULOS[campo]}>
        {criando ? <input className="campo" id={id} value={valor} maxLength={80} onChange={(e) => aoMudar(e.target.value)} />
          : <select className="seletor" id={id} value={valor} onChange={(e) => aoMudar(e.target.value)}>
            <option value="">Selecione</option>
            {valor && !opcoes.includes(valor) && <option value={valor}>{valor}</option>}
            {opcoes.map((opcao) => <option key={opcao}>{opcao}</option>)}
          </select>}
      </Campo>
      <button type="button" className="importados-link-botao" onClick={() => { setCriando(!criando); aoMudar(""); }}>
        {criando ? "Selecionar opção existente" : "Cadastrar opção"}
      </button>
    </div>
  );
}

function EditorProduto({ produto, opcoes, fechar }: { produto: ProdutoImportado | null; opcoes: OpcoesImportados; fechar: () => void }) {
  const [dados, setDados] = useState<DadosProdutoImportado>(produto ?? PRODUTO_VAZIO);
  const [preco, setPreco] = useState(produto?.preco != null ? centavosParaCampo(produto.preco) : "");
  const [erro, setErro] = useState("");
  const [erroFoto, setErroFoto] = useState("");
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function selecionarFoto(foto?: File) {
    if (!foto) return;
    setCarregandoFoto(true);
    setErroFoto("");
    try {
      const otimizada = await otimizarImagem(foto, { larguraMaxima: 420, alturaMaxima: 420, qualidade: 0.72 });
      setDados((anterior) => ({ ...anterior, foto: otimizada.dataUrl }));
    } catch {
      setErroFoto("Escolha uma foto PNG, JPG, WebP ou GIF de até 8 MB.");
    } finally {
      setCarregandoFoto(false);
    }
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (carregandoFoto) return;
    const valor = campoPreco(preco);
    if (!dados.nome.trim()) return setErro("Informe o nome do produto.");
    if (preco.trim() && valor === null) return setErro("Informe um valor válido e maior ou igual a zero.");
    if (dados.link.trim() && !linkDeImportado(dados.link)) return setErro("Informe um link começando com http:// ou https://.");
    if (!useImportados.getState().salvarProduto({ ...dados, preco: valor }, produto?.id)) return setErro("O produto não pôde ser salvo. Confira os dados.");
    useInterface.getState().avisar(produto ? "Produto atualizado." : "Produto adicionado.", undefined, "sucesso");
    fechar();
  }

  return (
    <Modal aberto largo titulo={produto ? "Editar produto" : "Novo produto"} aoFechar={fechar}>
      <form className="importados-editor" onSubmit={salvar}>
        <Campo id="importado-nome" rotulo="Nome do produto" obrigatorio><input className="campo" id="importado-nome" value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} required maxLength={120} /></Campo>
        <div className="importados-foto-editor">
          {dados.foto ? <img src={dados.foto} alt="Prévia da foto do produto" /> : <div className="importados-foto-vazia"><ImagePlus size={25} aria-hidden="true" /></div>}
          <div className="importados-foto-acoes">
            <Botao icone={<ImagePlus size={16} />} onClick={() => arquivo.current?.click()} disabled={carregandoFoto}>{carregandoFoto ? "Preparando foto…" : dados.foto ? "Trocar foto" : "Adicionar foto"}</Botao>
            <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => {
              const foto = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              void selecionarFoto(foto);
            }} />
            {dados.foto && <Botao variante="fantasma" onClick={() => setDados({ ...dados, foto: "" })} disabled={carregandoFoto}>Remover foto</Botao>}
            {erroFoto && <p className="campo-erro" role="alert">{erroFoto}</p>}
          </div>
        </div>
        <Campo id="importado-link" rotulo="Link do produto"><input className="campo" id="importado-link" type="url" value={dados.link} onChange={(e) => setDados({ ...dados, link: e.target.value })} maxLength={2048} placeholder="https://" /></Campo>
        <div className="importados-editor-grade">
          <Campo id="importado-preco" rotulo="Valor do produto"><input className="campo" id="importado-preco" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" maxLength={22} /></Campo>
          <Campo id="importado-moeda" rotulo="Moeda"><select className="seletor" id="importado-moeda" value={dados.moeda} onChange={(e) => setDados({ ...dados, moeda: e.target.value as MoedaImportada })}>
            {MOEDAS_IMPORTADOS.map((m) => <option key={m} value={m}>{MOEDAS[m]}</option>)}
          </select></Campo>
          {CAMPOS_IMPORTADOS.map((campo) => <SeletorDeOpcao key={campo} campo={campo} opcoes={opcoes[campo]} valor={dados[campo]} aoMudar={(valor) => setDados((anterior) => ({ ...anterior, [campo]: valor }))} />)}
        </div>
        <Campo id="importado-nota" rotulo="Observações"><textarea className="campo" id="importado-nota" rows={2} value={dados.nota} onChange={(e) => setDados({ ...dados, nota: e.target.value })} maxLength={600} /></Campo>
        {erro && <p className="campo-erro" role="alert">{erro}</p>}
        <div className="formulario-acoes">
          <Botao onClick={fechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" disabled={carregandoFoto}>Salvar produto</Botao>
        </div>
      </form>
    </Modal>
  );
}

function EditorOpcoes({ opcoes, fechar }: { opcoes: OpcoesImportados; fechar: () => void }) {
  const [campo, setCampo] = useState<CampoImportado>("categoria");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  return (
    <Modal aberto titulo="Opções dos filtros" aoFechar={fechar}>
      <form className="importados-editor" onSubmit={(e) => {
        e.preventDefault();
        if (!useImportados.getState().adicionarOpcao(campo, nome)) return setErro(nome.trim() ? "Essa opção já existe." : "Informe o nome da opção.");
        setNome("");
        setErro("");
      }}>
        <Campo id="importados-tipo-opcao" rotulo="Tipo de opção"><select id="importados-tipo-opcao" className="seletor" value={campo} onChange={(e) => {
          setCampo(e.target.value as CampoImportado); setErro("");
        }}>{CAMPOS_IMPORTADOS.map((tipo) => <option key={tipo} value={tipo}>{ROTULOS[tipo]}</option>)}</select></Campo>
        <Campo id="importados-nome-opcao" rotulo="Nome da opção" erro={erro}><input id="importados-nome-opcao" className="campo" value={nome} onChange={(e) => { setNome(e.target.value); setErro(""); }} maxLength={80} required /></Campo>
        <Botao variante="primario" type="submit" icone={<Plus size={16} />}>Adicionar opção</Botao>
        {opcoes[campo].length > 0 ? <ul className="importados-etiquetas" aria-label="Opções cadastradas">
          {opcoes[campo].map((opcao) => <li key={opcao}>{opcao}</li>)}
        </ul> : <p className="texto-2">Nenhuma opção cadastrada.</p>}
      </form>
    </Modal>
  );
}

export default function Importados({ mobile = false }: { mobile?: boolean }) {
  const produtos = useImportados((s) => s.produtos);
  const opcoesSalvas = useImportados((s) => s.opcoes);
  const opcoes = useMemo(() => listarOpcoesImportados(opcoesSalvas), [opcoesSalvas]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [editor, setEditor] = useState<ProdutoImportado | null | undefined>(undefined);
  const [gerenciar, setGerenciar] = useState(false);
  const [excluir, setExcluir] = useState<ProdutoImportado | null>(null);
  useEffect(() => {
    if (NATIVO) return;
    void useImportados.persist.rehydrate();
    return aoMudarDeFora((nome) => { if (nome === CHAVE_IMPORTADOS) void useImportados.persist.rehydrate(); });
  }, []);

  const minimo = filtros.moeda ? campoPreco(filtros.minimo) : null;
  const maximo = filtros.moeda ? campoPreco(filtros.maximo) : null;
  const faixaInvalida = Boolean(filtros.moeda && ((filtros.minimo.trim() && minimo === null) || (filtros.maximo.trim() && maximo === null) || (minimo !== null && maximo !== null && minimo > maximo)));
  const visiveis = faixaInvalida ? [] : filtrarImportados(produtos, { ...filtros, minimo, maximo });
  if (filtros.ordem === "nome") visiveis.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (filtros.ordem === "menor") visiveis.sort((a, b) => (a.preco ?? Infinity) - (b.preco ?? Infinity));
  if (filtros.ordem === "maior") visiveis.sort((a, b) => (b.preco ?? -Infinity) - (a.preco ?? -Infinity));
  const totalTexto = visiveis.length === 1 ? "1 produto" : `${visiveis.length} produtos`;

  return (
    <section className="importados" aria-label="Importados">
      <header className="importados-topo">
        <div><h1 className="titulo-pagina">Importados</h1><p>Produtos, preços e fornecedores para suas próximas importações.</p></div>
        <Botao variante="primario" icone={<Plus size={18} />} onClick={() => setEditor(null)}>Novo produto</Botao>
      </header>
      <div className="importados-filtros">
        <div className="importados-busca">
          <Search size={18} aria-hidden="true" />
          <input className="campo" type="search" aria-label="Buscar produtos" placeholder="Buscar produto ou fornecedor" value={filtros.busca} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} />
        </div>
        <details className="importados-filtros-detalhes" open={!mobile}>
        <summary><SlidersHorizontal size={16} aria-hidden="true" /> Filtros e ordenação</summary>
        <div className="importados-filtros-grade">
          {CAMPOS_IMPORTADOS.map((campo) => <Campo key={campo} id={`filtro-${campo}`} rotulo={ROTULOS[campo]}>
            <select className="seletor" id={`filtro-${campo}`} value={filtros[campo]} onChange={(e) => setFiltros({ ...filtros, [campo]: e.target.value })}>
              <option value="">Qualquer</option>
              {opcoes[campo].map((opcao) => <option key={opcao}>{opcao}</option>)}
            </select>
          </Campo>)}
          <Campo id="filtro-moeda" rotulo="Moeda"><select className="seletor" id="filtro-moeda" value={filtros.moeda} onChange={(e) => {
            const moeda = e.target.value as typeof filtros.moeda;
            setFiltros({ ...filtros, moeda, minimo: "", maximo: "", ordem: (moeda || filtros.ordem === "nome") ? filtros.ordem : "recentes" });
          }}><option value="">Todas as moedas</option>{MOEDAS_IMPORTADOS.map((m) => <option key={m} value={m}>{MOEDAS[m]}</option>)}</select></Campo>
          <Campo id="filtro-minimo" rotulo="Valor mínimo"><input className="campo" id="filtro-minimo" inputMode="decimal" disabled={!filtros.moeda} value={filtros.minimo} placeholder={filtros.moeda ? "Sem mínimo" : "Selecione uma moeda"} onChange={(e) => setFiltros({ ...filtros, minimo: e.target.value })} /></Campo>
          <Campo id="filtro-maximo" rotulo="Valor máximo"><input className="campo" id="filtro-maximo" inputMode="decimal" disabled={!filtros.moeda} value={filtros.maximo} placeholder={filtros.moeda ? "Sem máximo" : "Selecione uma moeda"} onChange={(e) => setFiltros({ ...filtros, maximo: e.target.value })} /></Campo>
          <Campo id="filtro-ordem" rotulo="Ordenar por"><select className="seletor" id="filtro-ordem" value={filtros.ordem} onChange={(e) => setFiltros({ ...filtros, ordem: e.target.value })}>
            <option value="recentes">Mais recentes</option><option value="nome">Nome</option>
            {filtros.moeda && <><option value="menor">Menor valor</option><option value="maior">Maior valor</option></>}
          </select></Campo>
        </div>
        {faixaInvalida && <p role="alert" className="campo-erro">Informe valores válidos e um máximo maior ou igual ao mínimo.</p>}
        </details>
        <div className="importados-filtros-acoes">
          <span role="status">{totalTexto}</span>
          <Botao variante="fantasma" onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar filtros</Botao>
          <Botao icone={<SlidersHorizontal size={15} />} onClick={() => setGerenciar(true)}>Opções dos filtros</Botao>
        </div>
      </div>
      {visiveis.length > 0 ? <ul className="importados-grade">
        {visiveis.map((produto) => <li className="importados-produto" key={produto.id}>
          <div className="importados-produto-foto">{produto.foto ? <img src={produto.foto} alt="" loading="lazy" /> : <PackageSearch size={34} aria-hidden="true" />}</div>
          <div className="importados-produto-corpo">
            {produto.categoria && <span className="importados-categoria">{produto.categoria}</span>}
            <h2>{produto.nome}</h2>
            <p className="importados-preco">{produto.preco === null ? "Valor a definir" : formatadores[produto.moeda].format(produto.preco / 100)}</p>
            <dl>{(["plataforma", "fornecedor", "origem"] as const).filter((campo) => produto[campo]).map((campo) => <div key={campo}><dt>{ROTULOS[campo]}</dt><dd>{produto[campo]}</dd></div>)}</dl>
            {produto.nota && <p className="importados-nota">{produto.nota}</p>}
            <div className="importados-produto-acoes">
              {produto.link && <a className="importados-link-botao" href={produto.link} target="_blank" rel="noopener noreferrer">Abrir produto <ArrowUpRight size={15} /></a>}
              <Botao soIcone icone={<Pencil size={16} />} aria-label={`Editar ${produto.nome}`} title="Editar produto" onClick={() => setEditor(produto)} />
              <Botao soIcone variante="fantasma" icone={<Trash2 size={16} />} aria-label={`Excluir ${produto.nome}`} title="Excluir produto" onClick={() => setExcluir(produto)} />
            </div>
          </div>
        </li>)}
      </ul> : <Vazio icone={<PackageSearch size={30} />} titulo={produtos.length ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"} texto={produtos.length ? "Ajuste a busca ou limpe os filtros." : undefined} />}
      {editor !== undefined && <EditorProduto produto={editor} opcoes={opcoes} fechar={() => setEditor(undefined)} />}
      {gerenciar && <EditorOpcoes opcoes={opcoes} fechar={() => setGerenciar(false)} />}
      {excluir && <ConfirmarModal aberto titulo="Excluir produto" texto={`Excluir ${excluir.nome} do seu catálogo?`} aoConfirmar={() => useImportados.getState().excluirProduto(excluir.id)} aoFechar={() => setExcluir(null)} />}
    </section>
  );
}
