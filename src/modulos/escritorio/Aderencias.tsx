import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Eye, FileImage, FileSpreadsheet, Image, LoaderCircle, Play, Plus, RefreshCw, Save, Send, Settings2, Trash2 } from "lucide-react";
import { AvisoFaixa, Botao, Cartao, Campo, LinhaAlternador, Modal } from "../../componentes/basicos";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { useWhatsapp } from "../../estado/whatsapp";
import { aderenciasPonte, aderenciasRemotas, type PreviaAderencia } from "../../ponte/aderencias";
import { novaPlanilhaAderencia, useAderencias } from "../../estado/aderencias";
import type { GrupoAderencia, PlanilhaAderencia } from "./aderenciasTipos";
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
          <Botao type="submit" variante="primario" icone={<CheckCircle2 size={14} />}>Salvar planilha</Botao>
        </div>
      </form>
    </Modal>
  );
}

export function Aderencias() {
  const EXECUCAO_REMOTA = aderenciasRemotas();
  const config = useAderencias((s) => s);
  const whatsapp = useWhatsapp((s) => s.estado);
  const carregarWhatsapp = useWhatsapp((s) => s.carregar);
  const [grupoId, setGrupoId] = useState("");
  const [editando, setEditando] = useState<{ grupoId: string; planilha: PlanilhaAderencia } | null>(null);
  const [previas, setPrevias] = useState<PreviaAderencia[]>([]);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [sincronia, setSincronia] = useState<"carregando" | "salvando" | "salvo" | "erro">(EXECUCAO_REMOTA ? "carregando" : "salvo");
  const [remotoPronto, setRemotoPronto] = useState(!EXECUCAO_REMOTA);

  useEffect(() => {
    void carregarWhatsapp();
    const relogio = window.setInterval(() => void carregarWhatsapp(), EXECUCAO_REMOTA ? 5000 : 15000);
    return () => window.clearInterval(relogio);
  }, [carregarWhatsapp]);
  useEffect(() => {
    if (!EXECUCAO_REMOTA) return;
    let ativo = true;
    void aderenciasPonte.configuracao()
      .then(({ configuracao }) => {
        if (!ativo) return;
        const remotoTemDados = configuracao.grupos.length > 0 || Boolean(configuracao.destinoJid);
        if (remotoTemDados) config.definir(configuracao);
      })
      .catch((e) => {
        if (ativo) {
          setSincronia("erro");
          setErro(`Não foi possível ler a configuração do VPS: ${(e as Error).message}`);
        }
      })
      .finally(() => { if (ativo) setRemotoPronto(true); });
    return () => { ativo = false; };
  }, []);
  const chaveDaSincroniaRemota = JSON.stringify({ destinoJid: config.destinoJid, destinoNome: config.destinoNome, grupos: config.grupos });
  useEffect(() => {
    if (!EXECUCAO_REMOTA || !remotoPronto) return;
    const timer = window.setTimeout(() => {
      setSincronia("salvando");
      void aderenciasPonte.salvarConfiguracao(config)
        .then(() => setSincronia("salvo"))
        .catch((e) => {
          setSincronia("erro");
          setErro(`Não foi possível sincronizar a rotina com o VPS: ${(e as Error).message}`);
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [chaveDaSincroniaRemota, remotoPronto]);
  useEffect(() => {
    if (!config.grupos.some((grupo) => grupo.id === grupoId)) setGrupoId(config.grupos[0]?.id ?? "");
  }, [config.grupos, grupoId]);

  const destinos = useMemo(() => whatsapp?.conversas ?? [], [whatsapp]);
  const conectado = whatsapp?.vinculo === "conectado";
  const grupo = config.grupos.find((item) => item.id === grupoId) ?? null;
  const totalPlanilhas = config.grupos.reduce((total, item) => total + item.planilhas.length, 0);
  const ultimoResultado = grupo?.ultimoResultado ?? config.ultimoResultado;

  const salvarConfiguracaoAgora = async () => {
    if (!EXECUCAO_REMOTA) {
      setSincronia("salvo");
      return;
    }
    setSincronia("salvando");
    setErro("");
    try {
      await aderenciasPonte.salvarConfiguracao(config);
      setSincronia("salvo");
    } catch (e) {
      setSincronia("erro");
      setErro(`Não foi possível salvar no VPS: ${(e as Error).message}`);
    }
  };

  const selecionarDestino = (jid: string) => {
    const conversa = destinos.find((c) => c.id === jid);
    config.definir({ destinoJid: jid, destinoNome: conversa ? nomeDoDestino(conversa.nome, conversa.grupo) : "" });
  };

  const adicionarRotina = () => {
    const id = config.adicionarGrupo({ nome: `Rotina ${config.grupos.length + 1}` });
    setGrupoId(id);
  };

  const removerRotina = () => {
    if (!grupo) return;
    const proximo = config.grupos.find((item) => item.id !== grupo.id)?.id ?? "";
    config.removerGrupo(grupo.id);
    setGrupoId(proximo);
  };

  const testar = async (planilha: PlanilhaAderencia) => {
    setErro(""); setProcessando(`teste:${planilha.id}`);
    try { setPrevias([await aderenciasPonte.testar(planilha)]); }
    catch (e) { setErro(`Não foi possível gerar a prévia: ${(e as Error).message}`); }
    finally { setProcessando(null); }
  };

  const enviar = async (planilha: PlanilhaAderencia) => {
    if (!grupo) return;
    if (!config.destinoJid) { setErro("Escolha um destino do WhatsApp antes de enviar."); return; }
    setErro(""); setProcessando(`envio:${planilha.id}`);
    try {
      const resposta = await aderenciasPonte.enviar(config, planilha);
      config.registrarResultado(grupo.id, resposta.resultado);
      setPrevias([resposta.previa]);
    } catch (e) { setErro(`Não foi possível enviar esta planilha: ${(e as Error).message}`); }
    finally { setProcessando(null); }
  };

  const executar = async () => {
    if (!grupo || !config.destinoJid || !grupo.planilhas.length) { setErro("Escolha uma rotina com destino e pelo menos uma planilha."); return; }
    setErro(""); setProcessando("execucao");
    try {
      const resposta = await aderenciasPonte.executar(config, grupo.id);
      config.registrarResultado(grupo.id, resposta.resultado);
      setPrevias(resposta.previas);
      if (resposta.resultado.erros.length) setErro(resposta.resultado.erros.join(" | "));
    } catch (e) { setErro(`Não foi possível executar a rotina: ${(e as Error).message}`); }
    finally { setProcessando(null); }
  };

  const abrirNovaPlanilha = () => {
    if (grupo) setEditando({ grupoId: grupo.id, planilha: novaPlanilhaAderencia() });
    else setErro("Crie uma rotina antes de adicionar planilhas.");
  };

  return (
    <section className="aderencias" aria-label="Robô de Aderências">
      <CabecalhoAba titulo="Robô de Aderências" subtitulo="Organize planilhas em rotinas de manhã, tarde ou noite e envie cada grupo no seu horário." />
      {!conectado
        ? <AvisoFaixa tipo="alerta"><span>{EXECUCAO_REMOTA ? "O VPS ainda não confirmou o WhatsApp conectado. Deixe o gateway ligado e atualize o estado." : <>Conecte o WhatsApp em <strong>Conexões</strong> para testar e enviar os resultados.</>}</span><Botao pequeno soIcone aria-label="Atualizar estado do WhatsApp" title="Atualizar estado" onClick={() => void carregarWhatsapp()} icone={<RefreshCw size={13} />} /></AvisoFaixa>
        : <AvisoFaixa><span><strong>WhatsApp conectado.</strong> Esta rotina será executada pelo {EXECUCAO_REMOTA ? "VPS" : "Kyro neste computador"} mesmo que esta tela seja fechada.</span></AvisoFaixa>}
      {erro && <AvisoFaixa tipo="erro"><span role="alert">{erro}</span></AvisoFaixa>}
      <div className="aderencias-resumo">
        <Cartao titulo="Planilhas configuradas" icone={<FileSpreadsheet size={15} />}><strong>{totalPlanilhas}</strong><span>em {config.grupos.length} rotina(s)</span></Cartao>
        <Cartao titulo="Destino" icone={<Send size={15} />}><strong>{config.destinoNome || "Não escolhido"}</strong><span>{conectado ? "WhatsApp conectado" : "Aguardando conexão"}</span></Cartao>
        <Cartao titulo="Último resultado" icone={<Clock3 size={15} />}><strong>{ultimoResultado ? `${ultimoResultado.planilhasEnviadas} enviadas` : "Ainda não executado"}</strong><span>{ultimoResultado?.executadoEm ? new Date(ultimoResultado.executadoEm).toLocaleString("pt-BR") : "Faça uma prévia ou envio"}</span></Cartao>
      </div>

      <Cartao titulo="Rotinas de envio" icone={<Clock3 size={15} />} acoes={<Botao pequeno variante="primario" icone={<Plus size={13} />} onClick={adicionarRotina}>Nova rotina</Botao>}>
        <div className="aderencias-cartao-corpo">
          {config.grupos.length === 0 ? <div className="aderencias-vazio"><Clock3 size={22} /><strong>Nenhuma rotina criada</strong><span>Crie uma rotina para separar os envios da manhã, tarde ou noite.</span><Botao pequeno variante="primario" icone={<Plus size={13} />} onClick={adicionarRotina}>Criar primeira rotina</Botao></div> : <>
            <div className="aderencias-rotinas-tabs" role="tablist" aria-label="Rotinas">
              {config.grupos.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === grupoId} onClick={() => setGrupoId(item.id)}><strong>{item.nome}</strong><span>{item.planilhas.length} planilha(s) · {item.hora}</span></button>)}
            </div>
            {grupo && <div className="aderencias-rotina-config">
              <Campo id="aderencia-rotina-nome" rotulo="Nome da rotina"><input id="aderencia-rotina-nome" className="campo" value={grupo.nome} onChange={(e) => config.atualizarGrupo(grupo.id, { nome: e.target.value })} placeholder="Ex.: Envio da manhã" /></Campo>
              <LinhaAlternador rotulo="Ativar esta rotina" dica="O envio automático respeita o horário e os dias escolhidos." ligado={grupo.ativo} aoMudar={(v) => config.atualizarGrupo(grupo.id, { ativo: v })} />
              <Campo id="aderencia-destino" rotulo="Destino do WhatsApp" dica="O mesmo destino pode ser usado por todas as rotinas.">
                <select id="aderencia-destino" className="seletor" value={config.destinoJid} onChange={(e) => selecionarDestino(e.target.value)}><option value="">Selecione um contato ou grupo</option>{destinos.map((c) => <option key={c.id} value={c.id}>{nomeDoDestino(c.nome, c.grupo)}</option>)}</select>
              </Campo>
              <div className="aderencias-grade-2">
                <Campo id="aderencia-frequencia" rotulo="Frequência"><select id="aderencia-frequencia" className="seletor" value={grupo.frequencia} onChange={(e) => config.atualizarGrupo(grupo.id, { frequencia: e.target.value as GrupoAderencia["frequencia"] })}><option value="manual">Somente manual</option><option value="diaria">Todos os dias</option><option value="semanal">Semanal</option></select></Campo>
                <Campo id="aderencia-hora" rotulo="Horário"><input id="aderencia-hora" className="campo" type="time" value={grupo.hora} onChange={(e) => config.atualizarGrupo(grupo.id, { hora: e.target.value })} /></Campo>
              </div>
              {grupo.frequencia === "semanal" && <div className="aderencias-dias" aria-label="Dias da semana">{DIAS.map((dia, i) => <button key={dia} type="button" aria-pressed={grupo.diasSemana.includes(i)} onClick={() => config.atualizarGrupo(grupo.id, { diasSemana: grupo.diasSemana.includes(i) ? grupo.diasSemana.filter((d) => d !== i) : [...grupo.diasSemana, i].sort() })}>{dia}</button>)}</div>}
              <div className="aderencias-acoes"><Botao variante="primario" icone={processando === "execucao" ? <LoaderCircle size={14} className="girando" /> : <Play size={14} />} disabled={!conectado || processando !== null} onClick={() => void executar()}>Executar rotina agora</Botao><Botao icone={<Save size={14} />} disabled={sincronia === "salvando"} onClick={() => void salvarConfiguracaoAgora()}>Salvar alterações</Botao><Botao variante="perigo" pequeno icone={<Trash2 size={13} />} onClick={removerRotina}>Excluir rotina</Botao><span className="campo-dica" role="status">{sincronia === "salvando" ? "Salvando no VPS…" : sincronia === "erro" ? "Falha ao salvar" : "Alterações salvas"} · só as planilhas desta rotina serão enviadas.</span></div>
            </div>}
          </>}
        </div>
      </Cartao>

      {grupo && <Cartao titulo={`Planilhas · ${grupo.nome}`} icone={<FileSpreadsheet size={15} />} acoes={<Botao pequeno icone={<Plus size={13} />} onClick={abrirNovaPlanilha}>Adicionar</Botao>}>
        <div className="aderencias-cartao-corpo">
          {grupo.planilhas.length === 0 ? <div className="aderencias-vazio"><FileSpreadsheet size={22} /><strong>Nenhuma planilha nesta rotina</strong><span>Adicione uma planilha compartilhada para começar.</span></div> : grupo.planilhas.map((p) => <article key={p.id} className="aderencias-planilha"><div className="aderencias-planilha-icone"><FileImage size={17} /></div><div className="aderencias-planilha-texto"><strong>{p.nome}</strong><span>{p.sheetUrl ? "Planilha Google configurada" : "Link pendente"} · {p.soPrint ? "somente print" : `amarelo ${p.yellowThreshold}d · vermelho ${p.redThreshold}d`}</span></div><div className="aderencias-planilha-acoes"><Botao pequeno soIcone aria-label={`Prévia ${p.nome}`} title="Gerar prévia sem enviar" disabled={!conectado || processando !== null} icone={processando === `teste:${p.id}` ? <LoaderCircle size={13} className="girando" /> : <Eye size={13} />} onClick={() => void testar(p)} /><Botao pequeno soIcone variante="primario" aria-label={`Enviar somente ${p.nome}`} title="Enviar somente esta planilha" disabled={!conectado || processando !== null} icone={processando === `envio:${p.id}` ? <LoaderCircle size={13} className="girando" /> : <Send size={13} />} onClick={() => void enviar(p)} /><Botao pequeno soIcone aria-label={`Editar ${p.nome}`} title="Editar" icone={<Settings2 size={13} />} onClick={() => setEditando({ grupoId: grupo.id, planilha: p })} /><Botao pequeno soIcone variante="perigo" aria-label={`Remover ${p.nome}`} title="Remover" icone={<Trash2 size={13} />} onClick={() => config.removerPlanilha(grupo.id, p.id)} /></div></article>)}
        </div>
      </Cartao>}

      {previas.length > 0 && <Cartao titulo="Prévia dos últimos testes/envios" icone={<Image size={15} />} className="aderencias-previa"><div className="aderencias-previas-lista">{previas.map((item, indice) => <div key={`${item.imagem.slice(-24)}-${indice}`} className="aderencias-previa-grid"><div><img src={item.imagem} alt={`Prévia da captura da planilha ${indice + 1}`} /></div><div><pre>{item.texto}</pre><div className="aderencias-contadores"><span className="aderencias-contador amarelo"><AlertTriangle size={13} />{item.alertas} atenção</span><span className="aderencias-contador vermelho"><AlertTriangle size={13} />{item.urgentes} crítico</span></div></div></div>)}</div></Cartao>}
      <FormularioPlanilha aberto={editando !== null} planilha={editando?.planilha ?? null} aoFechar={() => setEditando(null)} aoSalvar={(p) => { if (!editando) return; if (editando.planilha.nome) config.atualizarPlanilha(editando.grupoId, p.id, p); else config.adicionarPlanilha(editando.grupoId, p); setEditando(null); }} />
    </section>
  );
}
