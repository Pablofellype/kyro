import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Globe, ImagePlus, MapPin, PackageSearch, Pencil, Plus, Search, SlidersHorizontal, Store, Trash2 } from "lucide-react";
import { Botao, Campo, ConfirmarModal, Modal, Vazio } from "../../componentes/basicos";
import {
  CAMPOS_IMPORTADOS, CHAVE_IMPORTADOS, MAXIMO_FOTOS_IMPORTADOS, MOEDAS_IMPORTADOS, filtrarImportados, fotosDeImportado, linkDeImportado, listarOpcoesImportados, useImportados,
  type CampoImportado, type DadosProdutoImportado, type MoedaImportada, type OpcoesImportados, type ProdutoImportado,
} from "../../estado/importados";
import { useInterface } from "../../estado/interface";
import { useAuth } from "../../estado/autenticacao";
import { aoMudarDeFora } from "../../ponte/armazenamento";
import { NATIVO } from "../../desktop/desktop";
import { otimizarImagem } from "../../servicos/fotos";
import { centavosParaCampo, lerValorEmCentavos } from "../../utilitarios/dinheiro";
import { gerarId } from "../../utilitarios/basicos";
import { Fornecedores } from "./Fornecedores";
import { guardarRascunhoProduto, lerRascunhoProduto, type RascunhoProduto } from "./rascunhoProduto";
import { converterPrecoImportado, usarCambioImportados, type CambioImportados } from "./usarCambioImportados";
import "./importados.css";

const ROTULOS: Record<CampoImportado, string> = { categoria: "Categoria", plataforma: "Plataforma", fornecedor: "Fornecedor", origem: "Origem" };
const NOMES_MOEDAS: Record<MoedaImportada, string> = { BRL: "Real", USD: "Dólar", CNY: "Yuan", EUR: "Euro" };
const BANDEIRAS_MOEDAS: Record<MoedaImportada, string> = { BRL: "br", USD: "us", CNY: "cn", EUR: "eu" };
const DETALHES_PRODUTO = { plataforma: Globe, fornecedor: Store, origem: MapPin };
const formatadores = Object.fromEntries(MOEDAS_IMPORTADOS.map((moeda) => [moeda, new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda })]));
const OPCOES_VAZIAS = { categoria: "", plataforma: "", fornecedor: "", origem: "" };
const PRODUTO_VAZIO: DadosProdutoImportado = { ...OPCOES_VAZIAS, nome: "", link: "", fotos: [], preco: null, moeda: "BRL", nota: "" };
const FILTROS_INICIAIS = { ...OPCOES_VAZIAS, busca: "", moeda: "" as MoedaImportada | "", minimo: "", maximo: "", ordem: "recentes" };
const MOEDAS_DE_CONVERSAO = ["BRL", "USD", "CNY"] as const;

function campoPreco(texto: string) {
  const valor = lerValorEmCentavos(texto);
  return valor !== null && valor >= 0 ? valor : null;
}

function SeletorDeOpcao({ campo, opcoes, valor, aoMudar }: {
  campo: CampoImportado; opcoes: string[]; valor: string; aoMudar: (valor: string) => void;
}) {
  const [criando, setCriando] = useState(Boolean(valor && !opcoes.includes(valor)));
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

function IdentificacaoMoeda({ moeda }: { moeda: MoedaImportada }) {
  return <span className="importados-moeda">
    <img className="importados-bandeira" src={`/bandeiras/${BANDEIRAS_MOEDAS[moeda]}.png`} alt="" width={20} height={15} />
    <span>{NOMES_MOEDAS[moeda]}</span>
    <span className="importados-moeda-sigla">{moeda}</span>
  </span>;
}

function ValoresConvertidos({ preco, moeda, cambio }: { preco: number; moeda: MoedaImportada; cambio: CambioImportados }) {
  const valores = MOEDAS_DE_CONVERSAO.flatMap((destino) => {
    if (destino === moeda) return [];
    const valor = converterPrecoImportado(preco, moeda, destino, cambio);
    return valor === null ? [] : [{ destino, valor }];
  });
  if (!valores.length) return null;
  return <div className="importados-cambio">
    <p className="importados-preco-rotulo">Valores convertidos</p>
    <ul className="importados-conversoes" aria-label="Conversões de moeda">
      {valores.map(({ destino, valor }) => <li key={destino}>
        <IdentificacaoMoeda moeda={destino} />
        <strong>{formatadores[destino].format(valor / 100)}</strong>
      </li>)}
    </ul>
  </div>;
}

function GaleriaProduto({ fotos, nome }: { fotos: string[]; nome: string }) {
  const [indice, setIndice] = useState(0);
  const selecionada = Math.min(indice, fotos.length - 1);
  return <div className="importados-galeria">
    <div className="importados-produto-foto">{selecionada >= 0 ? <img src={fotos[selecionada]} alt={`${nome}, foto ${selecionada + 1}`} loading="lazy" /> : <PackageSearch size={34} aria-hidden="true" />}</div>
    {fotos.length > 1 && <div className="importados-miniaturas" aria-label={`Fotos de ${nome}`}>
      {fotos.map((foto, i) => <button type="button" key={i} aria-label={`Ver foto ${i + 1} de ${nome}`} aria-pressed={i === selecionada} onClick={() => setIndice(i)}><img src={foto} alt="" loading="lazy" /></button>)}
    </div>}
  </div>;
}

function EditorProduto({ rascunho, opcoes, mobile, cambio, falhouCambio, mudar, fechar, concluir }: {
  rascunho: RascunhoProduto; opcoes: OpcoesImportados; mobile: boolean; cambio?: CambioImportados; falhouCambio: boolean;
  mudar: (fn: (atual: RascunhoProduto) => RascunhoProduto) => void; fechar: () => void; concluir: () => void;
}) {
  const { dados, preco, produtoId } = rascunho;
  const [erro, setErro] = useState("");
  const [erroFoto, setErroFoto] = useState("");
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const titulo = produtoId ? "Editar produto" : "Novo produto";
  const valor = campoPreco(preco);
  useEffect(() => { painel.current?.scrollIntoView({ block: "start" }); }, [mobile]);

  function alterarDados(parcial: Partial<DadosProdutoImportado>) {
    mudar((atual) => ({ ...atual, dados: { ...atual.dados, ...parcial } }));
  }

  async function selecionarFotos(fotos: File[]) {
    const vagas = MAXIMO_FOTOS_IMPORTADOS - dados.fotos.length;
    if (!fotos.length || vagas <= 0 || carregandoFoto) return;
    setCarregandoFoto(true);
    setErroFoto("");
    try {
      const resultados = await Promise.allSettled(fotos.slice(0, vagas).map((foto) =>
        otimizarImagem(foto, { larguraMaxima: 420, alturaMaxima: 420, qualidade: 0.72 }),
      ));
      const prontas = fotosDeImportado(resultados.flatMap((r) => r.status === "fulfilled" ? [r.value.dataUrl] : []));
      mudar((atual) => ({ ...atual, dados: { ...atual.dados, fotos: [...atual.dados.fotos, ...prontas].slice(0, MAXIMO_FOTOS_IMPORTADOS) } }));
      if (prontas.length !== resultados.length) setErroFoto("Algumas fotos não puderam ser lidas. Use PNG, JPG, WebP ou GIF de até 8 MB.");
      else if (fotos.length > vagas) setErroFoto("Foram adicionadas apenas as fotos que cabem no limite de três.");
    } finally {
      setCarregandoFoto(false);
    }
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (carregandoFoto) return;
    if (!dados.nome.trim()) return setErro("Informe o nome do produto.");
    if (preco.trim() && valor === null) return setErro("Informe um valor válido e maior ou igual a zero.");
    if (dados.link.trim() && !linkDeImportado(dados.link)) return setErro("Informe um link começando com http:// ou https://.");
    if (!useImportados.getState().salvarProduto({ ...dados, preco: valor }, produtoId ?? undefined)) return setErro("O produto não pôde ser salvo. Confira os dados.");
    useInterface.getState().avisar(produtoId ? "Produto atualizado." : "Produto adicionado.", undefined, "sucesso");
    concluir();
  }

  const formulario = (
      <form className="importados-editor" onSubmit={salvar} aria-label={titulo}>
        <Campo id="importado-nome" rotulo="Nome do produto" obrigatorio><input className="campo" id="importado-nome" value={dados.nome} onChange={(e) => alterarDados({ nome: e.target.value })} required maxLength={120} /></Campo>
        <div className="importados-foto-editor">
          {dados.fotos.length > 0 && <ul className="importados-fotos-rascunho">
            {dados.fotos.map((foto, i) => <li key={i}>
              <img src={foto} alt={`Prévia da foto ${i + 1}`} />
              <Botao soIcone variante="fantasma" icone={<Trash2 size={15} />} aria-label={`Remover foto ${i + 1}`} disabled={carregandoFoto} onClick={() => {
                alterarDados({ fotos: dados.fotos.filter((_, indice) => indice !== i) });
                setErroFoto("");
              }} />
            </li>)}
          </ul>}
          <div className="importados-foto-acoes">
            <Botao icone={<ImagePlus size={16} />} onClick={() => arquivo.current?.click()} disabled={carregandoFoto || dados.fotos.length >= MAXIMO_FOTOS_IMPORTADOS}>{carregandoFoto ? "Preparando fotos…" : "Adicionar fotos"}</Botao>
            <span className="texto-2">{dados.fotos.length}/{MAXIMO_FOTOS_IMPORTADOS} fotos</span>
            <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => {
              const fotos = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = "";
              void selecionarFotos(fotos);
            }} />
          </div>
          {erroFoto && <p className="campo-erro" role="alert">{erroFoto}</p>}
        </div>
        <Campo id="importado-link" rotulo="Link do produto"><input className="campo" id="importado-link" type="url" inputMode="url" value={dados.link} onChange={(e) => alterarDados({ link: e.target.value })} maxLength={2048} placeholder="https://" /></Campo>
        <div className="importados-editor-grade">
          <Campo id="importado-preco" rotulo="Valor do produto"><input className="campo" id="importado-preco" inputMode="decimal" value={preco} onChange={(e) => { const texto = e.target.value; mudar((atual) => ({ ...atual, preco: texto })); }} placeholder="0,00" maxLength={22} /></Campo>
          <Campo id="importado-moeda" rotulo="Moeda"><select className="seletor" id="importado-moeda" value={dados.moeda} onChange={(e) => alterarDados({ moeda: e.target.value as MoedaImportada })}>
            {MOEDAS_IMPORTADOS.map((m) => <option key={m} value={m}>{NOMES_MOEDAS[m]} ({m})</option>)}
          </select></Campo>
          {valor !== null && (cambio ? <ValoresConvertidos preco={valor} moeda={dados.moeda} cambio={cambio} />
            : <p className="importados-cotacao importados-cotacao-editor" role="status">{falhouCambio ? "Cotação indisponível." : "Consultando cotação…"}</p>)}
          {CAMPOS_IMPORTADOS.map((campo) => <SeletorDeOpcao key={campo} campo={campo} opcoes={opcoes[campo]} valor={dados[campo]} aoMudar={(texto) => alterarDados({ [campo]: texto })} />)}
        </div>
        <Campo id="importado-nota" rotulo="Observações"><textarea className="campo" id="importado-nota" rows={2} value={dados.nota} onChange={(e) => alterarDados({ nota: e.target.value })} maxLength={600} /></Campo>
        {erro && <p className="campo-erro" role="alert">{erro}</p>}
        {confirmarDescarte && <p role="alert">Descartar as alterações deste rascunho?</p>}
        <div className="formulario-acoes">
          {confirmarDescarte ? <>
            <Botao onClick={() => setConfirmarDescarte(false)}>Manter rascunho</Botao>
            <Botao onClick={concluir}>Descartar rascunho</Botao>
          </> : <>
            <Botao variante="fantasma" disabled={carregandoFoto} onClick={() => setConfirmarDescarte(true)}>Descartar</Botao>
            <Botao onClick={fechar}>Fechar e manter rascunho</Botao>
            <Botao type="submit" variante="primario" disabled={carregandoFoto}>Salvar produto</Botao>
          </>}
        </div>
      </form>
  );
  return mobile ? <div className="importados-painel-editor" ref={painel}><h2>{titulo}</h2>{formulario}</div>
    : <Modal aberto largo titulo={titulo} aoFechar={fechar}>{formulario}</Modal>;
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
  const usuarioId = useAuth((s) => s.usuario?.id);
  const produtos = useImportados((s) => s.produtos);
  const opcoesSalvas = useImportados((s) => s.opcoes);
  const opcoes = useMemo(() => listarOpcoesImportados(opcoesSalvas), [opcoesSalvas]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [aba, setAba] = useState<"produtos" | "fornecedores">("produtos");
  const [rascunho, setRascunho] = useState(() => usuarioId ? lerRascunhoProduto(usuarioId) : null);
  const rascunhoAtual = useRef(rascunho);
  const [gerenciar, setGerenciar] = useState(false);
  const [excluir, setExcluir] = useState<ProdutoImportado | null>(null);
  const { cambio, falhou } = usarCambioImportados(aba === "produtos" && (Boolean(rascunho?.aberto) || produtos.some((produto) => produto.preco !== null)));
  useEffect(() => {
    if (NATIVO) return;
    void useImportados.persist.rehydrate();
    return aoMudarDeFora((nome) => { if (nome === CHAVE_IMPORTADOS) void useImportados.persist.rehydrate(); });
  }, []);

  function gravarRascunho(novo: RascunhoProduto | null) {
    rascunhoAtual.current = novo;
    if (usuarioId) guardarRascunhoProduto(usuarioId, novo);
    setRascunho(novo);
  }

  function abrirEditor(produto: ProdutoImportado | null) {
    const pendente = rascunhoAtual.current;
    if (pendente) {
      if (produto && pendente.produtoId !== produto.id) useInterface.getState().avisar("Conclua ou descarte o rascunho antes de editar outro produto.");
      gravarRascunho({ ...pendente, aberto: true });
      return;
    }
    gravarRascunho({
      chave: gerarId(), aberto: true, produtoId: produto?.id ?? null, dados: produto ?? PRODUTO_VAZIO,
      preco: produto?.preco != null ? centavosParaCampo(produto.preco) : "",
    });
  }

  function fecharEditor() {
    if (rascunhoAtual.current) gravarRascunho({ ...rascunhoAtual.current, aberto: false });
  }

  const minimo = filtros.moeda ? campoPreco(filtros.minimo) : null;
  const maximo = filtros.moeda ? campoPreco(filtros.maximo) : null;
  const faixaInvalida = Boolean(filtros.moeda && ((filtros.minimo.trim() && minimo === null) || (filtros.maximo.trim() && maximo === null) || (minimo !== null && maximo !== null && minimo > maximo)));
  const visiveis = faixaInvalida ? [] : filtrarImportados(produtos, { ...filtros, minimo, maximo });
  if (filtros.ordem === "nome") visiveis.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (filtros.ordem === "menor") visiveis.sort((a, b) => (a.preco ?? Infinity) - (b.preco ?? Infinity));
  if (filtros.ordem === "maior") visiveis.sort((a, b) => (b.preco ?? -Infinity) - (a.preco ?? -Infinity));
  const totalTexto = visiveis.length === 1 ? "1 produto" : `${visiveis.length} produtos`;
  const editor = rascunho?.aberto && <EditorProduto key={rascunho.chave} rascunho={rascunho} opcoes={opcoes} mobile={mobile}
    cambio={cambio} falhouCambio={falhou} mudar={(fn) => {
      const atual = rascunhoAtual.current;
      if (atual?.chave === rascunho.chave) gravarRascunho(fn(atual));
    }} fechar={fecharEditor} concluir={() => gravarRascunho(null)} />;
  const mostraCambio = Boolean(rascunho?.aberto || produtos.some((produto) => produto.preco !== null));

  return (
    <section className="importados" aria-label="Importados">
      <header className="importados-topo">
        <h1 className="titulo-pagina">Importados</h1>
        {aba === "produtos" && (!mobile || !editor) && <Botao variante="primario" icone={rascunho ? <Pencil size={17} /> : <Plus size={18} />} onClick={() => abrirEditor(null)}>
          {rascunho ? "Continuar rascunho" : "Novo produto"}
        </Botao>}
      </header>
      <div className="importados-abas" role="group" aria-label="Seções de Importados">
        <button type="button" aria-pressed={aba === "produtos"} onClick={() => setAba("produtos")}>Produtos</button>
        <button type="button" aria-pressed={aba === "fornecedores"} onClick={() => { fecharEditor(); setAba("fornecedores"); }}>Fornecedores</button>
      </div>
      {aba === "fornecedores" ? <Fornecedores opcoes={opcoes} /> : <>
      {mostraCambio && <p className="importados-cotacao" role="status">
        {cambio ? `${falhou ? "Última cotação disponível" : "Cotação de"} ${new Date(cambio.atualizadaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
          : falhou ? "Cotação indisponível. Os valores originais estão disponíveis." : "Consultando cotação…"}
      </p>}
      {mobile && editor ? editor : <>
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
          }}><option value="">Todas as moedas</option>{MOEDAS_IMPORTADOS.map((m) => <option key={m} value={m}>{NOMES_MOEDAS[m]} ({m})</option>)}</select></Campo>
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
          <GaleriaProduto fotos={produto.fotos} nome={produto.nome} />
          <div className="importados-produto-corpo">
            <div className="importados-produto-titulo">
              {produto.categoria && <span className="importados-categoria">{produto.categoria}</span>}
              <h2>{produto.nome}</h2>
            </div>
            <div className="importados-valores">
              {produto.preco === null ? <p className="importados-preco-rotulo">Valor a definir</p> : <>
                <div className="importados-preco-original">
                  <div className="importados-preco-identificacao">
                    <p className="importados-preco-rotulo">Preço original</p>
                    <IdentificacaoMoeda moeda={produto.moeda} />
                  </div>
                  <strong className="importados-preco">{formatadores[produto.moeda].format(produto.preco / 100)}</strong>
                </div>
                {cambio && <ValoresConvertidos preco={produto.preco} moeda={produto.moeda} cambio={cambio} />}
              </>}
            </div>
            {(produto.plataforma || produto.fornecedor || produto.origem) && <dl className="importados-produto-detalhes">
              {(["plataforma", "fornecedor", "origem"] as const).filter((campo) => produto[campo]).map((campo) => {
                const Icone = DETALHES_PRODUTO[campo];
                return <div key={campo}><dt><Icone size={14} aria-hidden="true" />{ROTULOS[campo]}</dt><dd>{produto[campo]}</dd></div>;
              })}
            </dl>}
            {produto.nota && <p className="importados-nota">{produto.nota}</p>}
            <div className="importados-produto-acoes">
              {produto.link && <a className="importados-link-botao" href={produto.link} target="_blank" rel="noopener noreferrer">Abrir produto <ArrowUpRight size={15} /></a>}
              <Botao soIcone icone={<Pencil size={16} />} aria-label={`Editar ${produto.nome}`} title="Editar produto" onClick={() => abrirEditor(produto)} />
              <Botao soIcone variante="fantasma" icone={<Trash2 size={16} />} aria-label={`Excluir ${produto.nome}`} title="Excluir produto" onClick={() => setExcluir(produto)} />
            </div>
          </div>
        </li>)}
      </ul> : <Vazio icone={<PackageSearch size={30} />} titulo={produtos.length ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"} texto={produtos.length ? "Ajuste a busca ou limpe os filtros." : undefined} />}
      {!mobile && editor}
      {gerenciar && <EditorOpcoes opcoes={opcoes} fechar={() => setGerenciar(false)} />}
      {excluir && <ConfirmarModal aberto titulo="Excluir produto" texto={`Excluir ${excluir.nome} do seu catálogo?`} aoConfirmar={() => useImportados.getState().excluirProduto(excluir.id)} aoFechar={() => setExcluir(null)} />}
      </>}
      </>}
    </section>
  );
}
