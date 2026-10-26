import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileImage, FileSpreadsheet, Image, LoaderCircle, Play, Plus, Send, Settings2, Trash2 } from "lucide-react";
import { AvisoFaixa, Botao, Cartao, Campo, LinhaAlternador, Modal } from "../../componentes/basicos";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { useWhatsapp } from "../../estado/whatsapp";
import { aderenciasPonte, type PreviaAderencia } from "../../ponte/aderencias";
import { novaPlanilhaAderencia, useAderencias } from "../../estado/aderencias";
import type { PlanilhaAderencia } from "./aderenciasTipos";
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
  const config = useAderencias((s) => s);
  const whatsapp = useWhatsapp((s) => s.estado);
  const carregarWhatsapp = useWhatsapp((s) => s.carregar);
  const [editando, setEditando] = useState<PlanilhaAderencia | null>(null);
  const [previas, setPrevias] = useState<PreviaAderencia[]>([]);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => { if (!whatsapp) void carregarWhatsapp(); }, [whatsapp, carregarWhatsapp]);

  const destinos = useMemo(() => whatsapp?.conversas ?? [], [whatsapp]);
  const conectado = whatsapp?.vinculo === "conectado";

  const selecionarDestino = (jid: string) => {
    const conversa = destinos.find((c) => c.id === jid);
    config.definir({ destinoJid: jid, destinoNome: conversa ? nomeDoDestino(conversa.nome, conversa.grupo) : "" });
  };

  const testar = async (planilha: PlanilhaAderencia) => {
    setErro(""); setProcessando(`teste:${planilha.id}`);
    try { setPrevias([await aderenciasPonte.testar(planilha)]); }
    catch (e) { setErro(`Não foi possível testar a planilha: ${(e as Error).message}`); }
    finally { setProcessando(null); }
  };

  const executar = async () => {
    if (!config.destinoJid || !config.planilhas.length) { setErro("Escolha um destino e adicione pelo menos uma planilha."); return; }
    setErro(""); setProcessando("execucao");
    try {
      const resposta = await aderenciasPonte.executar(config);
      config.registrarResultado(resposta.resultado);
      setPrevias(resposta.previas);
      if (resposta.resultado.erros.length) setErro(resposta.resultado.erros.join(" | "));
    } catch (e) { setErro(`Não foi possível executar o robô: ${(e as Error).message}`); }
    finally { setProcessando(null); }
  };

  return (
    <section className="aderencias" aria-label="Robô de Aderências">
      <CabecalhoAba titulo="Robô de Aderências" subtitulo="Leia suas planilhas, identifique alertas e envie um print organizado pelo WhatsApp." />
      {!conectado && <AvisoFaixa tipo="alerta"><span>Conecte o WhatsApp em <strong>Conexões</strong> para testar e enviar os resultados. As configurações podem ser preparadas antes.</span></AvisoFaixa>}
      {erro && <AvisoFaixa tipo="erro"><span role="alert">{erro}</span></AvisoFaixa>}
      <div className="aderencias-resumo">
        <Cartao titulo="Planilhas configuradas" icone={<FileSpreadsheet size={15} />}><strong>{config.planilhas.length}</strong><span>locais monitorados</span></Cartao>
        <Cartao titulo="Destino" icone={<Send size={15} />}><strong>{config.destinoNome || "Não escolhido"}</strong><span>{conectado ? "WhatsApp conectado" : "Aguardando conexão"}</span></Cartao>
        <Cartao titulo="Último resultado" icone={<Clock3 size={15} />}><strong>{config.ultimoResultado ? `${config.ultimoResultado.alertas} alertas` : "Ainda não executado"}</strong><span>{config.ultimoResultado?.executadoEm ? new Date(config.ultimoResultado.executadoEm).toLocaleString("pt-BR") : "Execute um teste ou envio"}</span></Cartao>
      </div>
      <div className="aderencias-colunas">
        <Cartao titulo="Configuração do robô" icone={<Settings2 size={15} />}>
          <div className="aderencias-cartao-corpo">
            <LinhaAlternador rotulo="Ativar agendamento" dica="O envio automático respeita o horário e os dias escolhidos." ligado={config.ativo} aoMudar={(v) => config.definir({ ativo: v })} />
            <Campo id="aderencia-destino" rotulo="Destino do WhatsApp" dica="Escolha uma conversa já conhecida pelo Kyro.">
              <select id="aderencia-destino" className="seletor" value={config.destinoJid} onChange={(e) => selecionarDestino(e.target.value)}>
                <option value="">Selecione um contato ou grupo</option>
                {destinos.map((c) => <option key={c.id} value={c.id}>{nomeDoDestino(c.nome, c.grupo)}</option>)}
              </select>
            </Campo>
            <div className="aderencias-grade-2">
              <Campo id="aderencia-frequencia" rotulo="Frequência"><select id="aderencia-frequencia" className="seletor" value={config.frequencia} onChange={(e) => config.definir({ frequencia: e.target.value as "manual" | "diaria" | "semanal" })}><option value="manual">Somente manual</option><option value="diaria">Todos os dias</option><option value="semanal">Semanal</option></select></Campo>
              <Campo id="aderencia-hora" rotulo="Horário"><input id="aderencia-hora" className="campo" type="time" value={config.hora} onChange={(e) => config.definir({ hora: e.target.value })} /></Campo>
            </div>
            {config.frequencia === "semanal" && <div className="aderencias-dias" aria-label="Dias da semana">{DIAS.map((dia, i) => <button key={dia} type="button" aria-pressed={config.diasSemana.includes(i)} onClick={() => config.definir({ diasSemana: config.diasSemana.includes(i) ? config.diasSemana.filter((d) => d !== i) : [...config.diasSemana, i].sort() })}>{dia}</button>)}</div>}
            <div className="aderencias-acoes"><Botao variante="primario" icone={processando === "execucao" ? <LoaderCircle size={14} className="girando" /> : <Play size={14} />} disabled={!conectado || processando !== null} onClick={() => void executar()}>Executar agora</Botao><span className="campo-dica">O envio inclui o print e o resumo dos alertas.</span></div>
          </div>
        </Cartao>
        <Cartao titulo="Planilhas e locais" icone={<FileSpreadsheet size={15} />} acoes={<Botao pequeno icone={<Plus size={13} />} onClick={() => setEditando(novaPlanilhaAderencia())}>Adicionar</Botao>}>
          <div className="aderencias-cartao-corpo">
            {config.planilhas.length === 0 ? <div className="aderencias-vazio"><FileSpreadsheet size={22} /><strong>Nenhuma planilha configurada</strong><span>Adicione uma planilha compartilhada para começar.</span></div> : config.planilhas.map((p) => <article key={p.id} className="aderencias-planilha"><div className="aderencias-planilha-icone"><FileImage size={17} /></div><div className="aderencias-planilha-texto"><strong>{p.nome}</strong><span>{p.sheetUrl ? "Planilha Google configurada" : "Link pendente"} · {p.soPrint ? "somente print" : `amarelo ${p.yellowThreshold}d · vermelho ${p.redThreshold}d`}</span></div><div className="aderencias-planilha-acoes"><Botao pequeno soIcone aria-label={`Testar ${p.nome}`} title="Testar planilha" disabled={!conectado || processando !== null} icone={processando === `teste:${p.id}` ? <LoaderCircle size={13} className="girando" /> : <Play size={13} />} onClick={() => void testar(p)} /><Botao pequeno soIcone aria-label={`Editar ${p.nome}`} title="Editar" icone={<Settings2 size={13} />} onClick={() => setEditando(p)} /><Botao pequeno soIcone variante="perigo" aria-label={`Remover ${p.nome}`} title="Remover" icone={<Trash2 size={13} />} onClick={() => config.remover(p.id)} /></div></article>)}
          </div>
        </Cartao>
      </div>
      {previas.length > 0 && <Cartao titulo="Prévia dos últimos testes" icone={<Image size={15} />} className="aderencias-previa"><div className="aderencias-previas-lista">{previas.map((item, indice) => <div key={`${item.imagem.slice(-24)}-${indice}`} className="aderencias-previa-grid"><div><img src={item.imagem} alt={`Prévia da captura da planilha ${indice + 1}`} /></div><div><pre>{item.texto}</pre><div className="aderencias-contadores"><span className="aderencias-contador amarelo"><AlertTriangle size={13} />{item.alertas} atenção</span><span className="aderencias-contador vermelho"><AlertTriangle size={13} />{item.urgentes} crítico</span></div></div></div>)}</div></Cartao>}
      <FormularioPlanilha aberto={editando !== null} planilha={editando} aoFechar={() => setEditando(null)} aoSalvar={(p) => { if (config.planilhas.some((x) => x.id === p.id)) config.atualizar(p.id, p); else config.adicionar(p); setEditando(null); }} />
    </section>
  );
}
