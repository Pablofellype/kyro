import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock3, Copy, Eye, FileImage, FileSpreadsheet, Image, LoaderCircle, Pencil, Play, Plus, RefreshCw, Save, Send, Settings2, Trash2, X } from "lucide-react";
import { AvisoFaixa, Botao, Cartao, Campo, LinhaAlternador, Modal } from "../../componentes/basicos";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { useWhatsapp } from "../../estado/whatsapp";
import { useAuth } from "../../estado/autenticacao";
import { aderenciasPonte, aderenciasRemotas, type PreviaAderencia } from "../../ponte/aderencias";
import { novaPlanilhaAderencia, useAderencias } from "../../estado/aderencias";
import { configuracaoAderenciasValida, type GrupoAderencia, type PlanilhaAderencia, type ResultadoAderencia } from "./aderenciasTipos";
import { aplicarRascunhoAderencias, copiarPlanilhasAderencias, criarRascunhoAderencias, type RascunhoAderencias } from "./edicaoAderencias";
import "./aderencias.css";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function nomeDoDestino(nome: string, grupo: boolean) {
  return `${grupo ? "Grupo" : "Contato"} · ${nome || "sem nome"}`;
}

function FormularioPlanilha({ aberto, planilha, aoFechar, aoSalvar }: { aberto: boolean; planilha: PlanilhaAderencia | null; aoFechar: () => void; aoSalvar: (p: PlanilhaAderencia) => void }) {
  const [rascunho, setRascunho] = useState<PlanilhaAderencia | null>(planilha);
  useEffect(() => setRascunho(planilha), [planilha]);
  if (!rascunho) return null;
  const mudar = (parcial: Partial<PlanilhaAderencia>) => setRascunho((atual) => atual ? { ...atual, ...parcial } : atual);
  return (
    <Modal aberto={aberto} titulo={rascunho.nome ? "Editar planilha de aderência" : "Adicionar planilha de aderência"} aoFechar={aoFechar} largo>
      <form className="formulario aderencias-formulario" onSubmit={(e) => { e.preventDefault(); aoSalvar(rascunho); }}>
        <AvisoFaixa><span>Use uma planilha compartilhada como <strong>Qualquer pessoa com o link · Leitor</strong>. O robô somente lê e captura a área configurada.</span></AvisoFaixa>
        <Campo id="aderencia-nome" rotulo="Nome do local" obrigatorio>
          <input id="aderencia-nome" className="campo" value={rascunho.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Prédio P1" required />
        </Campo>
        <Campo id="aderencia-planilha" rotulo="Link da planilha Google" obrigatorio dica="O Kyro extrai o ID do link /spreadsheets/d/.../edit.">
          <input id="aderencia-planilha" className="campo" type="url" value={rascunho.sheetUrl} onChange={(e) => mudar({ sheetUrl: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/.../edit" required />
        </Campo>
        <Campo id="aderencia-aba" rotulo="Link da aba específica" dica="Opcional. Use o link que contém #gid=...; sem ele, a primeira aba é usada.">
          <input id="aderencia-aba" className="campo" type="url" value={rascunho.tabUrl} onChange={(e) => mudar({ tabUrl: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..." />
        </Campo>
        <div className="aderencias-grade-2">
          <Campo id="aderencia-coluna-inicio" rotulo="Coluna inicial"><input id="aderencia-coluna-inicio" className="campo" value={rascunho.colStart} onChange={(e) => mudar({ colStart: e.target.value.toUpperCase() })} placeholder="A" /></Campo>
          <Campo id="aderencia-coluna-fim" rotulo="Coluna final"><input id="aderencia-coluna-fim" className="campo" value={rascunho.colEnd} onChange={(e) => mudar({ colEnd: e.target.value.toUpperCase() })} placeholder="C" /></Campo>
          <Campo id="aderencia-linha-inicio" rotulo="Linha inicial"><input id="aderencia-linha-inicio" className="campo" type="number" min={1} value={rascunho.rowStart} onChange={(e) => mudar({ rowStart: Number(e.target.value) || 1 })} /></Campo>
          <Campo id="aderencia-linha-fim" rotulo="Linha final"><input id="aderencia-linha-fim" className="campo" type="number" min={1} value={rascunho.rowEnd} onChange={(e) => mudar({ rowEnd: Number(e.target.value) || 30 })} /></Campo>
        </div>
        <label className="aderencias-check"><input type="checkbox" checked={rascunho.soPrint} onChange={(e) => mudar({ soPrint: e.target.checked })} /><span><strong>Apenas tirar print</strong><small>Envia a imagem sem analisar as cores das células.</small></span></label>
        {!rascunho.soPrint && <div className="aderencias-limiares">
          <div className="aderencias-limiares-titulo"><Settings2 size={14} /> Limiares de alerta</div>
          <div className="aderencias-grade-2">
            <Campo id="aderencia-vermelho" rotulo="Vermelho · dias"><input id="aderencia-vermelho" className="campo" type="number" min={1} value={rascunho.redThreshold} onChange={(e) => mudar({ redThreshold: Number(e.target.value) || 2 })} /></Campo>
            <Campo id="aderencia-amarelo" rotulo="Amarelo · dias"><input id="aderencia-amarelo" className="campo" type="number" min={1} disabled={!rascunho.yellowEnabled} value={rascunho.yellowThreshold} onChange={(e) => mudar({ yellowThreshold: Number(e.target.value) || 1 })} /></Campo>
          </div>
          <LinhaAlternador rotulo="Ativar alerta amarelo" dica="O vermelho é crítico; o amarelo é preventivo." ligado={rascunho.yellowEnabled} aoMudar={(v) => mudar({ yellowEnabled: v })} />
        </div>}
        <div className="formulario-acoes">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <span className="campo-dica">A planilha será salva junto com as alterações da rotina.</span>
          <Botao type="submit" variante="primario" icone={<CheckCircle2 size={14} />}>Aplicar à rotina</Botao>
        </div>
      </form>
    </Modal>
  );
}


export function Aderencias() {
  const usuario = useAuth((s) => s.usuario);
  const EXECUCAO_REMOTA = aderenciasRemotas(usuario);
  const config = useAderencias((s) => s);
  const whatsapp = useWhatsapp((s) => s.estado);
  const carregarWhatsapp = useWhatsapp((s) => s.carregar);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<RascunhoAderencias | null>(null);
  const [editando, setEditando] = useState<PlanilhaAderencia | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [origemId, setOrigemId] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [navegacaoPendente, setNavegacaoPendente] = useState<(() => void) | null>(null);
  const [previas, setPrevias] = useState<PreviaAderencia[]>([]);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [sincronia, setSincronia] = useState<"carregando" | "salvando" | "salvo" | "erro">(EXECUCAO_REMOTA ? "carregando" : "salvo");
  const [remotoPronto, setRemotoPronto] = useState(!EXECUCAO_REMOTA);
  const [recarga, setRecarga] = useState(0);
  const inicial = useRef("");
  const sessao = useRef(0);

  useEffect(() => {
    void carregarWhatsapp();
    if (EXECUCAO_REMOTA) return;
    const relogio = window.setInterval(() => void carregarWhatsapp(), 15000);
    return () => window.clearInterval(relogio);
  }, [carregarWhatsapp, EXECUCAO_REMOTA]);

  useEffect(() => {
    const atual = ++sessao.current;
    setGrupoId(null); setRascunho(null); setEditando(null); setCopiando(false);
    setPrevias([]); setErro(""); setProcessando(null); setNavegacaoPendente(null);
    setRemotoPronto(!EXECUCAO_REMOTA);
    if (!EXECUCAO_REMOTA) { setSincronia("salvo"); return; }
    setSincronia("carregando");
    void aderenciasPonte.configuracao()
      .then(({ configuracao }) => {
        if (sessao.current !== atual) return;
        useAderencias.getState().definir(configuracao);
        setRemotoPronto(true);
        setSincronia("salvo");
      })
      .catch((e) => {
        if (sessao.current !== atual) return;
        setSincronia("erro");
        setErro(`Não foi possível carregar as rotinas: ${(e as Error).message}`);
      });
    return () => { sessao.current++; };
  }, [EXECUCAO_REMOTA, usuario?.id, recarga]);

  const alterado = !!rascunho && (rascunho.novo || JSON.stringify(rascunho) !== inicial.current);
  useEffect(() => {
    if (!alterado) return;
    const avisar = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  const destinos = useMemo(() => whatsapp?.conversas ?? [], [whatsapp]);
  const conectado = whatsapp?.vinculo === "conectado";
  const grupoSalvo = config.grupos.find((item) => item.id === grupoId) ?? null;
  const grupo = rascunho?.grupo ?? grupoSalvo;
  const ultimoResultado = grupo?.ultimoResultado;
  const salvando = sincronia === "salvando";
  const ocupado = salvando || processando !== null;
  const podeConfigurar = remotoPronto && !ocupado;
  const origem = config.grupos.find((item) => item.id === origemId);

  const pedirSaida = (acao: () => void) => {
    if (alterado) setNavegacaoPendente(() => acao);
    else acao();
  };
  const voltar = () => pedirSaida(() => { setRascunho(null); setGrupoId(null); setPrevias([]); setErro(""); });
  const iniciarEdicao = (alvo?: GrupoAderencia, duplicar = false) => {
    const novo = criarRascunhoAderencias(config, alvo, duplicar);
    inicial.current = JSON.stringify(novo);
    setRascunho(novo); setGrupoId(alvo && !duplicar ? alvo.id : novo.grupo.id);
    setErro(""); setPrevias([]);
  };
  const mudarGrupo = (parcial: Partial<GrupoAderencia>) => setRascunho((atual) => atual ? { ...atual, grupo: { ...atual.grupo, ...parcial } } : atual);
  const cancelar = () => pedirSaida(() => { setRascunho(null); if (rascunho?.novo) setGrupoId(null); setErro(""); });

  const salvar = async () => {
    if (!rascunho || !podeConfigurar) return;
    const atual = sessao.current;
    setSincronia("salvando"); setErro("");
    try {
      // Releitura preserva resultados e horários já consumidos pelo VPS enquanto
      // o usuário estava no formulário. O rascunho nunca entra no armazenamento.
      const base = EXECUCAO_REMOTA ? (await aderenciasPonte.configuracao()).configuracao : useAderencias.getState();
      if (sessao.current !== atual) return;
      const proxima = aplicarRascunhoAderencias(base, rascunho);
      const salva = EXECUCAO_REMOTA ? (await aderenciasPonte.salvarConfiguracao(proxima)).configuracao : proxima;
      if (sessao.current !== atual) return;
      useAderencias.getState().definir(salva);
      setGrupoId(rascunho.excluir ? null : rascunho.grupo.id);
      setRascunho(null); setSincronia("salvo");
    } catch (e) {
      if (sessao.current !== atual) return;
      setSincronia("erro");
      setErro(`As alterações não foram salvas: ${(e as Error).message}`);
    }
  };

  const testar = async (planilha: PlanilhaAderencia) => {
    const atual = sessao.current;
    setErro(""); setProcessando(`teste:${planilha.id}`);
    try { const previa = await aderenciasPonte.testar(planilha); if (sessao.current === atual) setPrevias([previa]); }
    catch (e) { if (sessao.current === atual) setErro(`Não foi possível gerar a prévia: ${(e as Error).message}`); }
    finally { if (sessao.current === atual) setProcessando(null); }
  };

  const registrarResultado = async (id: string, resultado: ResultadoAderencia, atual: number) => {
    useAderencias.getState().registrarResultado(id, resultado);
    if (!EXECUCAO_REMOTA) return;
    try {
      const { configuracao: base } = await aderenciasPonte.configuracao();
      if (sessao.current !== atual || !base.grupos.some((g) => g.id === id)) return;
      const proxima = configuracaoAderenciasValida({ ...base, grupos: base.grupos.map((g) => g.id === id ? { ...g, ultimoResultado: resultado } : g) });
      const { configuracao: salva } = await aderenciasPonte.salvarConfiguracao(proxima);
      if (sessao.current === atual) useAderencias.getState().definir(salva);
    } catch {
      if (sessao.current === atual) setErro("O envio foi concluído, mas não foi possível atualizar o histórico no servidor.");
    }
  };

  const enviar = async (planilha?: PlanilhaAderencia) => {
    if (!grupoSalvo || rascunho) return;
    if (!config.destinoJid || !grupoSalvo.planilhas.length) { setErro("Escolha uma rotina com destino e pelo menos uma planilha."); return; }
    const atual = sessao.current;
    setErro(""); setProcessando(planilha ? `envio:${planilha.id}` : "execucao");
    try {
      const resposta = planilha ? await aderenciasPonte.enviar(config, planilha) : await aderenciasPonte.executar(config, grupoSalvo.id);
      if (sessao.current !== atual) return;
      setPrevias("previa" in resposta ? [resposta.previa] : resposta.previas);
      await registrarResultado(grupoSalvo.id, resposta.resultado, atual);
      if (sessao.current !== atual) return;
      if (resposta.resultado.erros.length) setErro(resposta.resultado.erros.join(" | "));
    } catch (e) { if (sessao.current === atual) setErro(`Não foi possível enviar: ${(e as Error).message}`); }
    finally { if (sessao.current === atual) setProcessando(null); }
  };

  const selecionarOrigem = (id: string) => {
    setOrigemId(id);
    setSelecionadas(config.grupos.find((item) => item.id === id)?.planilhas.map((p) => p.id) ?? []);
  };
  const abrirCopia = () => {
    selecionarOrigem(config.grupos.find((item) => item.id !== grupo?.id && item.planilhas.length)?.id ?? "");
    setCopiando(true);
  };
  const aplicarCopia = () => {
    if (!grupo || !origem) return;
    const planilhas = origem.planilhas.filter((p) => selecionadas.includes(p.id));
    if (grupo.planilhas.length + planilhas.length > 30) { setErro("Cada rotina pode ter até 30 planilhas. Selecione menos planilhas para copiar."); return; }
    mudarGrupo({ planilhas: [...grupo.planilhas, ...copiarPlanilhasAderencias(planilhas)] });
    setCopiando(false); setErro("");
  };
  const frequencia = (item: GrupoAderencia) => item.frequencia === "manual" ? "Somente manual" : item.frequencia === "diaria" ? "Todos os dias" : item.diasSemana.map((dia) => DIAS[dia]).join(" · ");

  return (
    <section className="aderencias" aria-label="Robô de Aderências">
      <CabecalhoAba titulo="Robô de Aderências" subtitulo="Organize planilhas em rotinas de manhã, tarde ou noite e envie cada grupo no seu horário." />
      {!conectado
        ? <AvisoFaixa tipo="alerta"><span>{EXECUCAO_REMOTA ? "O servidor ainda não confirmou o WhatsApp conectado. Atualize o estado para conferir." : <>Conecte o WhatsApp em <strong>Conexões</strong> para testar e enviar os resultados.</>}</span><Botao pequeno soIcone aria-label="Atualizar estado do WhatsApp" onClick={() => void carregarWhatsapp()} icone={<RefreshCw size={13} />} /></AvisoFaixa>
        : <AvisoFaixa><span><strong>WhatsApp conectado.</strong> As rotinas salvas continuam sendo executadas {EXECUCAO_REMOTA ? "no servidor" : "pelo Kyro neste computador"} mesmo com esta tela fechada.</span></AvisoFaixa>}
      {erro && <AvisoFaixa tipo="erro"><span role="alert">{erro}</span>{!remotoPronto && sincronia === "erro" && <Botao pequeno onClick={() => setRecarga((v) => v + 1)} icone={<RefreshCw size={13} />}>Tentar novamente</Botao>}</AvisoFaixa>}
      {sincronia === "carregando" && <AvisoFaixa><span role="status">Carregando suas rotinas…</span></AvisoFaixa>}
      {processando && <AvisoFaixa><span role="status" aria-live="polite">{processando.startsWith("teste:") ? "Gerando a prévia da planilha. Aguarde a conclusão." : "Aguarde a captura das planilhas e a confirmação dos envios pelo WhatsApp."}</span></AvisoFaixa>}

      {!grupo ? <Cartao titulo="Suas rotinas de envio" icone={<Clock3 size={15} />} acoes={<Botao pequeno variante="primario" disabled={!podeConfigurar || config.grupos.length >= 30} icone={<Plus size={13} />} onClick={() => iniciarEdicao()}>Nova rotina</Botao>}>
        {config.grupos.length === 0 ? <div className="aderencias-vazio"><Clock3 size={22} /><strong>Nenhuma rotina criada</strong><span>Crie uma rotina para separar os envios da manhã, tarde ou noite.</span><Botao pequeno variante="primario" disabled={!podeConfigurar} onClick={() => iniciarEdicao()}>Criar primeira rotina</Botao></div> : <div className="aderencias-rotinas-grade">
          {config.grupos.map((item) => <article className="aderencias-rotina-card" key={item.id}>
            <div className="aderencias-rotina-card-topo"><span className={`aderencias-status ${item.ativo && item.frequencia !== "manual" ? "ativo" : ""}`}>{item.frequencia === "manual" ? "Manual" : item.ativo ? "Ativa" : "Pausada"}</span><Botao pequeno soIcone disabled={!podeConfigurar || config.grupos.length >= 30} aria-label={`Duplicar ${item.nome}`} title="Duplicar rotina com todas as planilhas" icone={<Copy size={14} />} onClick={() => iniciarEdicao(item, true)} /></div>
            <button type="button" className="aderencias-rotina-abrir" disabled={!podeConfigurar} aria-label={`Abrir ${item.nome}`} onClick={() => { setGrupoId(item.id); setErro(""); }}>
              <strong>{item.nome}</strong><span className="aderencias-rotina-hora"><Clock3 size={18} />{item.hora}</span><span>{frequencia(item)}</span><span><FileSpreadsheet size={14} />{item.planilhas.length} planilha(s) configurada(s)</span><span className="aderencias-rotina-link">Ver rotina <ArrowRight size={14} /></span>
            </button>
          </article>)}
        </div>}
      </Cartao> : <>
        <div className="aderencias-detalhe-topo"><Botao pequeno disabled={ocupado} icone={<ArrowLeft size={14} />} onClick={voltar}>Todas as rotinas</Botao><span className="campo-dica">{rascunho ? "Edição da rotina" : "Visualização da rotina"}</span></div>
        <div className="aderencias-resumo">
          <Cartao titulo="Planilhas nesta rotina" icone={<FileSpreadsheet size={15} />}><strong>{grupo.planilhas.length}</strong><span>{grupo.nome}</span></Cartao>
          <Cartao titulo="Destino" icone={<Send size={15} />}><strong>{(rascunho?.destinoNome ?? config.destinoNome) || "Não escolhido"}</strong><span>{conectado ? "WhatsApp conectado" : "Aguardando conexão"}</span></Cartao>
          <Cartao titulo="Último resultado" icone={<Clock3 size={15} />}><strong>{ultimoResultado ? `${ultimoResultado.planilhasEnviadas} enviadas` : "Ainda não executado"}</strong><span>{ultimoResultado?.executadoEm ? new Date(ultimoResultado.executadoEm).toLocaleString("pt-BR") : "Os resultados aparecem após o envio"}</span></Cartao>
        </div>
        <Cartao titulo={grupo.nome} icone={<Clock3 size={15} />} acoes={!rascunho && <><Botao pequeno disabled={!podeConfigurar || config.grupos.length >= 30} icone={<Copy size={13} />} onClick={() => iniciarEdicao(grupo, true)}>Duplicar rotina</Botao><Botao pequeno variante="primario" disabled={!podeConfigurar} icone={<Pencil size={13} />} onClick={() => iniciarEdicao(grupo)}>Editar rotina</Botao></>}>
          {rascunho ? <form className="aderencias-rotina-config" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
            <AvisoFaixa tipo={rascunho.excluir ? "alerta" : "info"}><span>{rascunho.excluir ? "Esta rotina será excluída ao salvar as alterações." : rascunho.novo ? "A nova rotina só será criada ao salvar. Confira o nome, o horário e a ativação." : "As alterações só entram em vigor ao clicar em Salvar alterações."}</span></AvisoFaixa>
            <fieldset className="aderencias-edicao-campos" disabled={salvando || rascunho.excluir}>
              <Campo id="aderencia-rotina-nome" rotulo="Nome da rotina" obrigatorio><input id="aderencia-rotina-nome" className="campo" required maxLength={100} value={grupo.nome} onChange={(e) => mudarGrupo({ nome: e.target.value })} /></Campo>
              <LinhaAlternador rotulo="Ativar esta rotina" dica="O envio automático respeita o horário e os dias escolhidos." ligado={grupo.ativo} desativado={salvando || rascunho.excluir} aoMudar={(ativo) => mudarGrupo({ ativo })} />
              <Campo id="aderencia-destino" rotulo="Destino do WhatsApp" dica="Destino compartilhado: esta mudança vale para todas as rotinas.">
                <select id="aderencia-destino" className="seletor" value={rascunho.destinoJid} onChange={(e) => { const jid = e.target.value; const conversa = destinos.find((c) => c.id === jid); setRascunho({ ...rascunho, destinoJid: jid, destinoNome: conversa ? nomeDoDestino(conversa.nome, conversa.grupo) : "" }); }}><option value="">Selecione um contato ou grupo</option>{rascunho.destinoJid && !destinos.some((c) => c.id === rascunho.destinoJid) && <option value={rascunho.destinoJid}>{rascunho.destinoNome || "Destino salvo"}</option>}{destinos.map((c) => <option key={c.id} value={c.id}>{nomeDoDestino(c.nome, c.grupo)}</option>)}</select>
              </Campo>
              <div className="aderencias-grade-2">
                <Campo id="aderencia-frequencia" rotulo="Frequência"><select id="aderencia-frequencia" className="seletor" value={grupo.frequencia} onChange={(e) => mudarGrupo({ frequencia: e.target.value as GrupoAderencia["frequencia"] })}><option value="manual">Somente manual</option><option value="diaria">Todos os dias</option><option value="semanal">Semanal</option></select></Campo>
                <Campo id="aderencia-hora" rotulo="Horário"><input id="aderencia-hora" className="campo" type="time" required value={grupo.hora} onChange={(e) => mudarGrupo({ hora: e.target.value })} /></Campo>
              </div>
              {grupo.frequencia === "semanal" && <div className="aderencias-dias" aria-label="Dias da semana">{DIAS.map((dia, i) => <button key={dia} type="button" aria-pressed={grupo.diasSemana.includes(i)} onClick={() => mudarGrupo({ diasSemana: grupo.diasSemana.includes(i) ? grupo.diasSemana.filter((d) => d !== i) : [...grupo.diasSemana, i].sort() })}>{dia}</button>)}</div>}
            </fieldset>
            <div className="aderencias-acoes"><Botao type="submit" variante="primario" disabled={ocupado || !alterado} icone={salvando ? <LoaderCircle size={14} className="girando" /> : <Save size={14} />}>{salvando ? "Salvando…" : "Salvar alterações"}</Botao><Botao disabled={salvando} icone={<X size={14} />} onClick={cancelar}>Cancelar</Botao>{!rascunho.novo && <Botao pequeno variante="perigo" disabled={salvando} icone={<Trash2 size={13} />} onClick={() => setRascunho({ ...rascunho, excluir: !rascunho.excluir })}>{rascunho.excluir ? "Manter rotina" : "Excluir rotina"}</Botao>}<span className="campo-dica" role="status">{salvando ? "Salvando alterações…" : "Rascunho: a configuração salva continua valendo."}</span></div>
          </form> : <div className="aderencias-cartao-corpo">
            <dl className="aderencias-detalhes"><div><dt>Horário</dt><dd>{grupo.hora}</dd></div><div><dt>Frequência</dt><dd>{frequencia(grupo)}</dd></div><div><dt>Situação</dt><dd>{grupo.frequencia === "manual" ? "Envio manual" : grupo.ativo ? "Rotina ativa" : "Rotina pausada"}</dd></div><div><dt>Planilhas</dt><dd>{grupo.planilhas.length} configurada(s)</dd></div></dl>
            <div className="aderencias-acoes"><Botao variante="primario" disabled={!conectado || ocupado || !remotoPronto || !grupo.planilhas.length} icone={processando === "execucao" ? <LoaderCircle size={14} className="girando" /> : <Play size={14} />} onClick={() => void enviar()}>Executar rotina agora</Botao><span className="campo-dica">Use o lápis para editar as configurações e as planilhas.</span></div>
          </div>}
        </Cartao>

        {!rascunho?.excluir && <Cartao titulo={`Planilhas · ${grupo.planilhas.length} configurada(s)`} icone={<FileSpreadsheet size={15} />} acoes={rascunho && <><Botao pequeno disabled={salvando || grupo.planilhas.length >= 30 || !config.grupos.some((g) => g.id !== grupo.id && g.planilhas.length)} icone={<Copy size={13} />} onClick={abrirCopia}>Copiar de outra rotina</Botao><Botao pequeno disabled={salvando || grupo.planilhas.length >= 30} icone={<Plus size={13} />} onClick={() => setEditando(novaPlanilhaAderencia())}>Adicionar planilha</Botao></>}>
          <div className="aderencias-cartao-corpo">
            {grupo.planilhas.length === 0 ? <div className="aderencias-vazio"><FileSpreadsheet size={22} /><strong>Nenhuma planilha nesta rotina</strong><span>{rascunho ? "Adicione uma planilha ou copie as já configuradas em outra rotina." : "Clique no lápis para adicionar ou copiar planilhas."}</span></div> : grupo.planilhas.map((p) => <article key={p.id} className="aderencias-planilha">
              <div className="aderencias-planilha-icone"><FileImage size={17} /></div><div className="aderencias-planilha-texto"><strong>{p.nome}</strong><span>{p.colStart}{p.rowStart}:{p.colEnd}{p.rowEnd} · {p.soPrint ? "somente print" : `amarelo ${p.yellowThreshold}d · vermelho ${p.redThreshold}d`}</span></div>
              <div className="aderencias-planilha-acoes"><Botao pequeno soIcone aria-label={`Prévia ${p.nome}`} title="Gerar prévia sem enviar" disabled={!conectado || ocupado} icone={processando === `teste:${p.id}` ? <LoaderCircle size={13} className="girando" /> : <Eye size={13} />} onClick={() => void testar(p)} />{rascunho ? <><Botao pequeno soIcone disabled={ocupado} aria-label={`Editar ${p.nome}`} title="Editar planilha" icone={<Pencil size={13} />} onClick={() => setEditando(p)} /><Botao pequeno soIcone variante="perigo" disabled={ocupado} aria-label={`Remover ${p.nome}`} title="Remover da rotina" icone={<Trash2 size={13} />} onClick={() => mudarGrupo({ planilhas: grupo.planilhas.filter((item) => item.id !== p.id) })} /></> : <Botao pequeno soIcone variante="primario" aria-label={`Enviar somente ${p.nome}`} title="Enviar somente esta planilha" disabled={!conectado || ocupado || !remotoPronto} icone={processando === `envio:${p.id}` ? <LoaderCircle size={13} className="girando" /> : <Send size={13} />} onClick={() => void enviar(p)} />}</div>
            </article>)}
          </div>
        </Cartao>}
      </>}

      {previas.length > 0 && <Cartao titulo="Prévia dos últimos testes/envios" icone={<Image size={15} />} className="aderencias-previa"><div className="aderencias-previas-lista">{previas.map((item, indice) => <div key={indice} className="aderencias-previa-grid"><div><a href={item.imagem} target="_blank" rel="noreferrer" title="Abrir imagem em tamanho original"><img src={item.imagem} alt={`Prévia da captura da planilha ${indice + 1}`} /></a></div><div><pre>{item.texto}</pre><div className="aderencias-contadores"><span className="aderencias-contador amarelo"><AlertTriangle size={13} />{item.alertas} atenção</span><span className="aderencias-contador vermelho"><AlertTriangle size={13} />{item.urgentes} crítico</span></div></div></div>)}</div></Cartao>}
      <FormularioPlanilha aberto={editando !== null} planilha={editando} aoFechar={() => setEditando(null)} aoSalvar={(p) => { if (!grupo || !rascunho || salvando) return; const existe = grupo.planilhas.some((item) => item.id === p.id); mudarGrupo({ planilhas: existe ? grupo.planilhas.map((item) => item.id === p.id ? p : item) : [...grupo.planilhas, p] }); setEditando(null); }} />
      <Modal aberto={copiando} titulo="Copiar planilhas de outra rotina" aoFechar={() => setCopiando(false)} largo>
        <div className="formulario"><p className="campo-dica">Escolha as planilhas para esta rotina. Os links, intervalos e alertas serão copiados e poderão ser editados separadamente.</p><Campo id="aderencia-origem" rotulo="Rotina de origem"><select id="aderencia-origem" className="seletor" value={origemId} onChange={(e) => selecionarOrigem(e.target.value)}><option value="">Selecione uma rotina</option>{config.grupos.filter((item) => item.id !== grupo?.id && item.planilhas.length).map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.planilhas.length} planilha(s)</option>)}</select></Campo>
          {origem && <><label className="aderencias-check"><input type="checkbox" checked={origem.planilhas.every((p) => selecionadas.includes(p.id))} onChange={(e) => setSelecionadas(e.target.checked ? origem.planilhas.map((p) => p.id) : [])} /><strong>Selecionar todas</strong></label><div className="aderencias-copia-lista">{origem.planilhas.map((p) => <label key={p.id} className="aderencias-check"><input type="checkbox" checked={selecionadas.includes(p.id)} onChange={(e) => setSelecionadas(e.target.checked ? [...selecionadas, p.id] : selecionadas.filter((id) => id !== p.id))} /><span><strong>{p.nome}</strong><small>{p.colStart}{p.rowStart}:{p.colEnd}{p.rowEnd}</small></span></label>)}</div></>}
          <div className="formulario-acoes"><Botao onClick={() => setCopiando(false)}>Cancelar</Botao><Botao variante="primario" disabled={!selecionadas.length || !origem || (grupo?.planilhas.length ?? 0) + selecionadas.length > 30} icone={<Copy size={14} />} onClick={aplicarCopia}>Copiar {selecionadas.length} planilha(s)</Botao></div><span className="campo-dica">{(grupo?.planilhas.length ?? 0) + selecionadas.length > 30 ? "Limite de 30 planilhas por rotina. Selecione menos planilhas." : "Conclua em Salvar alterações na rotina."}</span>
        </div>
      </Modal>
      <Modal aberto={navegacaoPendente !== null} titulo="Descartar alterações?" aoFechar={() => setNavegacaoPendente(null)}><p>Você tem alterações que ainda não foram salvas. Ao sair, esse rascunho será descartado.</p><div className="formulario-acoes"><Botao onClick={() => setNavegacaoPendente(null)}>Continuar editando</Botao><Botao variante="perigo" onClick={() => { navegacaoPendente?.(); setNavegacaoPendente(null); }}>Descartar alterações</Botao></div></Modal>
    </section>
  );
}
