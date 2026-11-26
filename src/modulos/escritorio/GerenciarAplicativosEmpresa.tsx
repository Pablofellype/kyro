import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { AvisoFaixa, Botao, Campo } from "../../componentes/basicos";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { gerarId } from "../../utilitarios/basicos";
import { STATUS_APLICATIVO, TIPOS_DE_ANEXO, TIPOS_PROPOSTA, type AnexoProposta, type AplicativoEmpresa, type StatusAplicativo, type TipoProposta } from "./aplicativosEmpresaConfig";
import { carregarCatalogoAppsEmpresa, enviarAnexoProposta, ErroAppsEmpresa, erroDoArquivoProposta, salvarAppEmpresa, useCatalogoAppsEmpresa } from "./catalogoAppsEmpresa";
import "./gerenciarAplicativosEmpresa.css";

type Edicao = Omit<AplicativoEmpresa, "id"> & { id: string | null; criacaoId?: string };
type ArquivosSelecionados = Partial<Record<TipoProposta, File>>;
const formatarMb = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const ERROS_EDICAO: Record<string, string> = {
  aplicativo_invalido: "Preencha o nome e use um endereço válido para o aplicativo.",
  proposta_invalida: "Confira os dados da proposta. Links de vídeo e PDF devem começar com https://.",
  arquivo_proposta_invalido: "Confira o tipo e o tamanho do arquivo da proposta.",
  armazenamento_propostas_indisponivel: "O armazenamento de arquivos da proposta está indisponível. Você pode salvar um link HTTPS no lugar do arquivo.",
};

export function GerenciarAplicativosEmpresa() {
  const token = useAuth((s) => s.token);
  const { aplicativos, pronto, erro } = useCatalogoAppsEmpresa();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [arquivos, setArquivos] = useState<ArquivosSelecionados>({});
  const [errosArquivos, setErrosArquivos] = useState<Partial<Record<TipoProposta, string>>>({});
  const [arquivoEmEnvio, setArquivoEmEnvio] = useState<TipoProposta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroEdicao, setErroEdicao] = useState("");
  const envio = useRef<AbortController | null>(null);
  const camposArquivo = useRef<Partial<Record<TipoProposta, HTMLInputElement | null>>>({});
  const temArquivoInvalido = TIPOS_DE_ANEXO.some((tipo) => Boolean(errosArquivos[tipo]));

  useEffect(() => () => envio.current?.abort(), [token]);

  function abrirEdicao(app?: AplicativoEmpresa) {
    setErroEdicao("");
    setArquivos({});
    setErrosArquivos({});
    setEdicao(app ?? { id: null, criacaoId: gerarId(), nome: "", url: "", descricao: "", status: "disponivel", publico: false });
  }

  function limparSelecao(tipo: TipoProposta) {
    const campo = camposArquivo.current[tipo];
    if (campo) campo.value = "";
    setArquivos((atuais) => ({ ...atuais, [tipo]: undefined }));
    setErrosArquivos((atuais) => ({ ...atuais, [tipo]: undefined }));
    setErroEdicao("");
  }

  function alterarProposta(tipo: TipoProposta, anexo?: AnexoProposta) {
    setEdicao((atual) => atual ? { ...atual, proposta: { ...atual.proposta, [tipo]: anexo } } : atual);
    limparSelecao(tipo);
  }

  function selecionarArquivo(tipo: TipoProposta, campo: HTMLInputElement) {
    const arquivo = campo.files?.[0];
    if (!arquivo) return;
    const erro = erroDoArquivoProposta(tipo, arquivo);
    if (erro) campo.value = "";
    // Mantenha o nome no seletor nativo para um arquivo válido.
    setArquivos((atuais) => ({ ...atuais, [tipo]: erro ? undefined : arquivo }));
    setErrosArquivos((atuais) => ({ ...atuais, [tipo]: erro }));
    setErroEdicao("");
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!token || !edicao || envio.current || temArquivoInvalido) return;
    const controle = new AbortController();
    envio.current = controle;
    setSalvando(true);
    setErroEdicao("");
    try {
      const id = edicao.id ?? `app-${edicao.criacaoId}`;
      const proposta = { ...edicao.proposta };
      for (const tipo of TIPOS_DE_ANEXO) {
        const arquivo = arquivos[tipo];
        if (!arquivo) continue;
        setArquivoEmEnvio(tipo);
        const anexo = await enviarAnexoProposta(token, id, tipo, arquivo, controle.signal);
        if (controle.signal.aborted || useAuth.getState().token !== token) return;
        proposta[tipo] = anexo;
        alterarProposta(tipo, anexo);
      }
      setArquivoEmEnvio(null);
      await salvarAppEmpresa(token, { ...edicao, proposta }, controle.signal);
      if (controle.signal.aborted || useAuth.getState().token !== token) return;
      setEdicao(null);
      useInterface.getState().avisar(edicao.id ? "Aplicativo atualizado." : "Aplicativo adicionado ao menu.", undefined, "sucesso");
    } catch (falha) {
      if (!controle.signal.aborted) setErroEdicao((falha instanceof ErroAppsEmpresa && ERROS_EDICAO[falha.message]) || "Não foi possível salvar o aplicativo. Tente novamente.");
    } finally {
      envio.current = null;
      setArquivoEmEnvio(null);
      setSalvando(false);
    }
  }

  return <>
    <CabecalhoAba titulo="Gerenciar aplicativos" subtitulo="Adicione sistemas, altere o status e inclua materiais da proposta." />
    <section className="gerenciar-apps" aria-label="Catálogo de aplicativos">
      {!pronto && !erro && <p role="status">Carregando aplicativos…</p>}
      {erro && <AvisoFaixa tipo="alerta">
        Não foi possível atualizar o catálogo.{" "}
        <Botao pequeno disabled={!token} onClick={() => { if (token) void carregarCatalogoAppsEmpresa(token); }}>Tentar novamente</Botao>
      </AvisoFaixa>}
      {pronto && <div className="gerenciar-apps-acoes">
        <Botao variante="primario" icone={<Plus size={16} />} disabled={salvando} onClick={() => abrirEdicao()}>Adicionar aplicativo</Botao>
      </div>}
      {edicao && <form key={edicao.id ?? edicao.criacaoId} className="gerenciar-apps-form" onSubmit={salvar} aria-labelledby="gerenciar-apps-titulo">
        <h2 id="gerenciar-apps-titulo">{edicao.id ? "Editar aplicativo" : "Novo aplicativo"}</h2>
        <fieldset disabled={salvando}>
          <Campo rotulo="Nome da aba" id="gerenciar-app-nome" obrigatorio>
            <input id="gerenciar-app-nome" className="campo" autoFocus key={edicao.id ?? edicao.criacaoId} required maxLength={80} value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
          </Campo>
          <Campo rotulo="Link do aplicativo" id="gerenciar-app-url" obrigatorio={edicao.status === "disponivel"}>
            <input id="gerenciar-app-url" className="campo" type="url" required={edicao.status === "disponivel"} placeholder="https://" maxLength={2048} value={edicao.url ?? ""} onChange={(e) => setEdicao({ ...edicao, url: e.target.value })} />
          </Campo>
          <Campo rotulo="Descrição" id="gerenciar-app-descricao">
            <input id="gerenciar-app-descricao" className="campo" maxLength={240} value={edicao.descricao} onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} />
          </Campo>
          <Campo rotulo="Status" id="gerenciar-app-status">
            <select id="gerenciar-app-status" className="campo" value={edicao.status} onChange={(e) => setEdicao({ ...edicao, status: e.target.value as StatusAplicativo })}>
              {Object.entries(STATUS_APLICATIVO).map(([valor, rotulo]) => <option value={valor} key={valor}>{rotulo}</option>)}
            </select>
          </Campo>
          <label className="gerenciar-apps-publico"><input type="checkbox" checked={edicao.publico} onChange={(e) => setEdicao({ ...edicao, publico: e.target.checked })} />Mostrar no portal público</label>
        </fieldset>
        <fieldset className="gerenciar-apps-proposta" disabled={salvando}>
          <legend>Proposta</legend>
          <p>Disponível para usuários autenticados na área Empresa.</p>
          {TIPOS_DE_ANEXO.map((tipo) => {
            const { rotulo, mime, extensao, limiteMb } = TIPOS_PROPOSTA[tipo];
            const anexo = edicao.proposta?.[tipo];
            const pendente = arquivos[tipo];
            const erroArquivo = errosArquivos[tipo];
            const idArquivo = `proposta-arquivo-${tipo}`;
            return <div key={tipo} className="gerenciar-apps-anexo">
              <Campo rotulo={rotulo} id={idArquivo} dica={`${extensao.toUpperCase()} até ${limiteMb} MB`} erro={erroArquivo}>
                <input className="campo" id={idArquivo} type="file" accept={`.${extensao},${mime}`} ref={(campo) => { camposArquivo.current[tipo] = campo; }}
                  aria-invalid={Boolean(erroArquivo)} aria-describedby={erroArquivo ? `${idArquivo}-erro` : `${idArquivo}-dica`}
                  onChange={(e) => selecionarArquivo(tipo, e.currentTarget)} />
              </Campo>
              {(pendente || erroArquivo) && <div className="gerenciar-apps-anexo-atual">
                {pendente && <span role="status">Selecionado para envio: <strong>{pendente.name}</strong> · {formatarMb.format(pendente.size / 1024 ** 2)} MB</span>}
                <Botao pequeno onClick={() => limparSelecao(tipo)} aria-label={`Limpar seleção de ${rotulo}`}>Limpar seleção</Botao>
              </div>}
              <Campo rotulo={`Ou link do ${tipo === "pdf" ? "PDF" : "vídeo"}`} id={`proposta-link-${tipo}`}>
                <input className="campo" id={`proposta-link-${tipo}`} type="url" placeholder="https://" maxLength={2048} value={!pendente && anexo?.origem === "link" ? anexo.url : ""} onChange={(e) => alterarProposta(tipo, e.target.value ? { origem: "link", url: e.target.value } : undefined)} />
              </Campo>
              {anexo && !pendente && <div className="gerenciar-apps-anexo-atual">
                {anexo.origem === "arquivo" && <span>Anexado: <strong>{anexo.nome}</strong></span>}
                <Botao pequeno onClick={() => alterarProposta(tipo)} aria-label={`Remover ${rotulo}`}>Remover</Botao>
              </div>}
            </div>;
          })}
        </fieldset>
        {erroEdicao && <AvisoFaixa tipo="alerta">{erroEdicao}</AvisoFaixa>}
        <div className="gerenciar-apps-acoes">
          <Botao disabled={salvando} onClick={() => setEdicao(null)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando || temArquivoInvalido}>{salvando ? "Salvando…" : "Salvar aplicativo"}</Botao>
        </div>
        {arquivoEmEnvio && <span role="status">{arquivoEmEnvio === "video" ? "Enviando vídeo…" : "Enviando PDF…"}</span>}
      </form>}
      {pronto && <ul className="gerenciar-apps-lista">
        {aplicativos.map((app) => <li key={app.id}>
          <div><strong>{app.nome}</strong><span>{app.url ?? "Sem link cadastrado"}</span></div>
          <small><span className="app-empresa-status" data-status={app.status}>{STATUS_APLICATIVO[app.status]}</span> · {app.publico ? "Público" : "Interno"}</small>
          <Botao pequeno disabled={salvando} aria-label={`Editar ${app.nome}`} icone={<Pencil size={14} />} onClick={() => abrirEdicao(app)}>Editar</Botao>
        </li>)}
      </ul>}
    </section>
  </>;
}
