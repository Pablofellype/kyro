import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, FileText, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  formatarVariacoes,
  useMateriais,
  type MaterialItem,
  type VariacaoMaterial,
} from "../../../estado/materiais";
import { tocarSom } from "../../../ponte/sons";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function MateriaisNaBarra({
  topo,
}: {
  topo: number;
  aoFechar: () => void;
}) {
  const { materiais, adicionarMaterial, atualizarMaterial, importarTexto, excluirMaterial } =
    useMateriais();
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [modoCadastro, setModoCadastro] = useState<"fechado" | "item" | "lote">("fechado");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [codigosNovo, setCodigosNovo] = useState("");
  const [textoLote, setTextoLote] = useState("");
  const [avisoLote, setAvisoLote] = useState<string | null>(null);

  const copiarCodigo = async (chaveUnica: string, codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      void tocarSom("blip");
      setCopiado(chaveUnica);
      window.setTimeout(() => {
        setCopiado((atual) => (atual === chaveUnica ? null : atual));
      }, 1500);
    } catch {
      return;
    }
  };

  const abrirEdicao = (item: MaterialItem) => {
    setEditandoId(item.id);
    setNomeNovo(item.nome);
    setCodigosNovo(formatarVariacoes(item.variacoes));
    setModoCadastro("item");
  };

  const salvarItem = () => {
    if (!nomeNovo.trim() || !codigosNovo.trim()) return;
    if (editandoId) {
      atualizarMaterial(editandoId, nomeNovo, codigosNovo);
    } else {
      adicionarMaterial(nomeNovo, codigosNovo);
    }
    void tocarSom("blip");
    setNomeNovo("");
    setCodigosNovo("");
    setEditandoId(null);
    setModoCadastro("fechado");
  };

  const salvarLote = () => {
    const qtd = importarTexto(textoLote);
    if (qtd > 0) {
      void tocarSom("blip");
      setTextoLote("");
      setModoCadastro("fechado");
      setAvisoLote(`${qtd} material(is) importado(s)`);
      window.setTimeout(() => setAvisoLote(null), 2500);
    } else {
      setAvisoLote("Formato não reconhecido. Use Nome na 1ª linha e Códigos na 2ª.");
    }
  };

  const filtrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return { lista: materiais, termosTamanho: [] as string[] };

    const lista = materiais.filter((item) => {
      const textoCompleto = normalizar(
        `${item.nome} ${item.variacoes.map((v) => `${v.tamanho} ${v.codigo}`).join(" ")}`,
      );
      return termos.every((t) => textoCompleto.includes(t));
    });

    const termosTamanho = termos.filter(
      (t) => /^\d+$/.test(t) || /^(pp|p|m|g|gg|xg|eg)$/i.test(t),
    );
    return { lista, termosTamanho };
  }, [materiais, busca]);

  const tamanhoDestacado = (v: VariacaoMaterial) => {
    if (filtrados.termosTamanho.length === 0) return false;
    const tNorm = normalizar(v.tamanho);
    const cNorm = normalizar(v.codigo);
    return filtrados.termosTamanho.some(
      (termo) =>
        tNorm === termo ||
        tNorm.endsWith(` ${termo}`) ||
        tNorm.endsWith(`º${termo}`) ||
        cNorm.includes(termo),
    );
  };

  return (
    <motion.div
      className="ilha-pop ilha-personalizar ilha-materiais"
      style={{ top: topo, maxHeight: `calc(100vh - ${topo + 12}px)` }}
      role="dialog"
      aria-label="Catálogo de Materiais"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
      transition={{ type: "spring", visualDuration: 0.28, bounce: 0.15 }}
    >
      <div className="ilha-materiais-topo">
        <div className="ilha-materiais-cabecalho">
          <span className="ilha-personalizar-titulo">
            <Package size={14} />
            Códigos de Materiais ({materiais.length})
          </span>
          <div className="ilha-materiais-acoes-topo">
            <button
              type="button"
              className="ilha-rapido-texto-pequeno ilha-materiais-btn"
              data-ativo={modoCadastro === "item" || undefined}
              onClick={() => {
                setEditandoId(null);
                setNomeNovo("");
                setCodigosNovo("");
                setModoCadastro((m) => (m === "item" ? "fechado" : "item"));
              }}
              title="Adicionar um material"
            >
              <Plus size={12} />
              Novo
            </button>
            <button
              type="button"
              className="ilha-rapido-texto-pequeno ilha-materiais-btn"
              data-ativo={modoCadastro === "lote" || undefined}
              onClick={() => setModoCadastro((m) => (m === "lote" ? "fechado" : "lote"))}
              title="Colar lista de materiais"
            >
              <FileText size={12} />
              Colar lista
            </button>
          </div>
        </div>

        <div className="ilha-materiais-busca">
          <Search size={13} className="ilha-materiais-busca-icone" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar material, nº/tamanho (ex: bota 40) ou código..."
            aria-label="Buscar material, tamanho ou código"
          />
          {busca && (
            <button
              type="button"
              className="ilha-materiais-limpar"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {avisoLote && <span className="ilha-materiais-aviso">{avisoLote}</span>}
      </div>

      {modoCadastro === "item" && (
        <div className="ilha-personalizar-grupo ilha-materiais-form">
          <span className="ilha-personalizar-rotulo">
            {editandoId ? "Editar material" : "Novo material"}
          </span>
          <input
            type="text"
            className="ilha-materiais-input"
            placeholder="Nome (ex: BOTA PRETA ou ÓCULOS POLICARBONATO)"
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
          />
          <textarea
            className="ilha-materiais-textarea"
            rows={3}
            placeholder="Código único (ex: 7000427) ou tamanhos separados por | (ex: Nº 33:7003123 | Nº 34:7003124)"
            value={codigosNovo}
            onChange={(e) => setCodigosNovo(e.target.value)}
          />
          <div className="ilha-materiais-form-botoes">
            <button
              type="button"
              className="ilha-rapido-texto-pequeno"
              onClick={() => {
                setModoCadastro("fechado");
                setEditandoId(null);
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ilha-rapido-texto-pequeno ilha-materiais-salvar"
              onClick={salvarItem}
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {modoCadastro === "lote" && (
        <div className="ilha-personalizar-grupo ilha-materiais-form">
          <span className="ilha-personalizar-rotulo">
            Cole um ou mais materiais (Nome na 1ª linha, códigos na 2ª linha):
          </span>
          <textarea
            className="ilha-materiais-textarea"
            rows={5}
            placeholder={"BOTA PRETA\nNº 33:7003123 |Nº 34:7003124\n\nÓCULOS POLICARBONATO\n7000427"}
            value={textoLote}
            onChange={(e) => setTextoLote(e.target.value)}
          />
          <div className="ilha-materiais-form-botoes">
            <button
              type="button"
              className="ilha-rapido-texto-pequeno"
              onClick={() => setModoCadastro("fechado")}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ilha-rapido-texto-pequeno ilha-materiais-salvar"
              onClick={salvarLote}
            >
              Importar tudo
            </button>
          </div>
        </div>
      )}

      <div className="ilha-materiais-lista">
        {filtrados.lista.length === 0 ? (
          <p className="ilha-rapido-vazio">Nenhum material encontrado para "{busca}".</p>
        ) : (
          filtrados.lista.map((item) => {
            const unico = item.variacoes.length === 1 && !item.variacoes[0].tamanho;
            return (
              <section key={item.id} className="ilha-personalizar-grupo ilha-material-card">
                <div className="ilha-material-topo">
                  <span className="ilha-material-nome">{item.nome}</span>
                  <div className="ilha-material-controles">
                    {unico && (
                      <button
                        type="button"
                        className="ilha-material-pilula ilha-material-pilula-unica"
                        data-copiado={copiado === `${item.id}-0` || undefined}
                        onClick={() => copiarCodigo(`${item.id}-0`, item.variacoes[0].codigo)}
                        title="Clique para copiar o código"
                      >
                        <span className="ilha-material-codigo">{item.variacoes[0].codigo}</span>
                        {copiado === `${item.id}-0` ? <Check size={12} /> : <Copy size={11} />}
                      </button>
                    )}
                    <button
                      type="button"
                      className="bt-botao-icone"
                      title="Editar material"
                      onClick={() => abrirEdicao(item)}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      className="bt-botao-icone"
                      title="Excluir material"
                      onClick={() => excluirMaterial(item.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {!unico && (
                  <div className="ilha-material-grade">
                    {item.variacoes.map((v, idx) => {
                      const idPilula = `${item.id}-${idx}`;
                      const foiCopiado = copiado === idPilula;
                      const destacado = tamanhoDestacado(v);
                      return (
                        <button
                          key={idPilula}
                          type="button"
                          className="ilha-material-pilula"
                          data-copiado={foiCopiado || undefined}
                          data-destacado={destacado || undefined}
                          onClick={() => copiarCodigo(idPilula, v.codigo)}
                          title={`Copiar código ${v.codigo} (${v.tamanho || item.nome})`}
                        >
                          {v.tamanho && <span className="ilha-material-tam">{v.tamanho}</span>}
                          <span className="ilha-material-codigo">{v.codigo}</span>
                          {foiCopiado ? <Check size={11} /> : <Copy size={10} className="ilha-material-icone-copia" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
