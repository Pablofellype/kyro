import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AppWindow, CheckCircle2, ClipboardList, LoaderCircle, PackageOpen, Search } from "lucide-react";
import { AvisoFaixa, Botao, Campo, Modal } from "../../componentes/basicos";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { cabecalhosNiko, useAuth, urlApi } from "../../estado/autenticacao";
import { useMateriais } from "../../estado/materiais";
import { controle, type AppInstalado } from "../../ponte/ponteLocal";
import { NATIVO } from "../../desktop/desktop";

export function PainelColaborador() {
  const usuario = useAuth((s) => s.usuario);
  const token = useAuth((s) => s.token);
  const materiais = useMateriais((s) => s.materiais);
  const [modalMaterial, setModalMaterial] = useState(false);
  const [modalApps, setModalApps] = useState(false);
  const [materialId, setMaterialId] = useState(materiais[0]?.id ?? "");
  const [variacao, setVariacao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [erro, setErro] = useState("");
  const [apps, setApps] = useState<AppInstalado[]>([]);
  const [busca, setBusca] = useState("");
  const [abrindoApp, setAbrindoApp] = useState<string | null>(null);

  const material = materiais.find((item) => item.id === materialId) ?? materiais[0];
  const appsFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase();
    return apps.filter((app) => !termo || app.nome.toLocaleLowerCase().includes(termo));
  }, [apps, busca]);

  useEffect(() => {
    if (!material) return;
    setMaterialId((atual) => materiais.some((item) => item.id === atual) ? atual : material.id);
    setVariacao(material.variacoes[0]?.tamanho || material.variacoes[0]?.codigo || "");
  }, [material, materiais]);

  useEffect(() => {
    if (!modalApps || !NATIVO) return;
    let vivo = true;
    void controle.apps().then((lista) => { if (vivo) setApps(lista.sort((a, b) => a.nome.localeCompare(b.nome))); }).catch(() => { if (vivo) setApps([]); });
    return () => { vivo = false; };
  }, [modalApps]);

  const solicitarMaterial = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!material || !token || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const resposta = await fetch(urlApi("/api/solicitacoes"), {
        method: "POST",
        headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: material.id, materialNome: material.nome, variacao, quantidade: Number(quantidade), observacao }),
      });
      const dados = await resposta.json().catch(() => ({})) as { protocolo?: string; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível enviar a solicitação.");
      setProtocolo(dados.protocolo || "registrado");
      setObservacao("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a solicitação.");
    } finally {
      setEnviando(false);
    }
  };

  const abrirApp = async (app: AppInstalado) => {
    setAbrindoApp(app.id);
    try { await controle.abrirApp(app.id); } catch { setErro(`Não foi possível abrir ${app.nome}.`); }
    finally { setAbrindoApp(null); }
  };

  return (
    <>
      <CabecalhoAba
        titulo={`Olá, ${usuario?.nome?.trim().split(/\s+/)[0] || "colaborador"}`}
        subtitulo="Este é o painel da empresa. Faça uma solicitação de material ou abra um aplicativo de trabalho."
      />
      <div className="colaborador-painel">
        <div className="colaborador-boas-vindas">
          <div><span className="colaborador-kicker">PAINEL DA EMPRESA</span><h2>O que você precisa hoje?</h2><p>Escolha uma ação rápida para continuar seu trabalho.</p></div>
          <ClipboardList size={42} aria-hidden="true" />
        </div>
        {erro && <AvisoFaixa tipo="erro">{erro}</AvisoFaixa>}
        <div className="colaborador-acoes">
          <button type="button" className="colaborador-acao" onClick={() => { setProtocolo(""); setErro(""); setModalMaterial(true); }}>
            <span className="colaborador-acao-icone"><PackageOpen size={25} /></span>
            <span><strong>Solicitar material</strong><small>Escolha o material, tamanho e quantidade.</small></span>
          </button>
          <button type="button" className="colaborador-acao" onClick={() => { setErro(""); setModalApps(true); }}>
            <span className="colaborador-acao-icone"><AppWindow size={25} /></span>
            <span><strong>Abrir aplicativo</strong><small>Acesse os aplicativos instalados neste computador.</small></span>
          </button>
        </div>
        <div className="colaborador-nota"><CheckCircle2 size={16} /><span>Seu acesso está limitado ao ambiente da empresa.</span></div>
      </div>

      <Modal aberto={modalMaterial} titulo="Solicitar material" aoFechar={() => setModalMaterial(false)}>
        {protocolo ? (
          <div className="colaborador-sucesso"><CheckCircle2 size={28} /><h3>Solicitação enviada</h3><p>Seu pedido foi registrado para análise da empresa.</p><code>{protocolo}</code><Botao variante="primario" onClick={() => setModalMaterial(false)}>Concluir</Botao></div>
        ) : (
          <form className="formulario colaborador-formulario" onSubmit={(e) => void solicitarMaterial(e)}>
            {materiais.length === 0 ? <AvisoFaixa tipo="alerta">O catálogo de materiais ainda não foi configurado.</AvisoFaixa> : <>
              <Campo id="colaborador-material" rotulo="Material" obrigatorio>
                <select id="colaborador-material" className="seletor campo" value={material?.id ?? ""} onChange={(e) => setMaterialId(e.target.value)} required>
                  {materiais.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </Campo>
              <Campo id="colaborador-variacao" rotulo="Tamanho ou código">
                <select id="colaborador-variacao" className="seletor campo" value={variacao} onChange={(e) => setVariacao(e.target.value)}>
                  {(material?.variacoes ?? []).map((item) => { const valor = item.tamanho || item.codigo; return <option key={`${item.tamanho}-${item.codigo}`} value={valor}>{item.tamanho ? `${item.tamanho} — ${item.codigo}` : item.codigo}</option>; })}
                </select>
              </Campo>
              <Campo id="colaborador-quantidade" rotulo="Quantidade" obrigatorio><input id="colaborador-quantidade" className="campo" type="number" min={1} max={99} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required /></Campo>
              <Campo id="colaborador-observacao" rotulo="Observação"><textarea id="colaborador-observacao" className="campo" rows={3} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Alguma informação para a empresa?" /></Campo>
              <div className="formulario-acoes"><Botao type="button" onClick={() => setModalMaterial(false)}>Cancelar</Botao><Botao type="submit" variante="primario" disabled={enviando || !material}>{enviando ? <><LoaderCircle size={14} className="girando" /> Enviando...</> : "Enviar solicitação"}</Botao></div>
            </>}
          </form>
        )}
      </Modal>

      <Modal aberto={modalApps} titulo="Aplicativos de trabalho" aoFechar={() => setModalApps(false)} largo>
        {!NATIVO ? <AvisoFaixa tipo="info">A abertura de aplicativos está disponível no aplicativo Kyro para computador.</AvisoFaixa> : <div className="colaborador-apps"><div className="colaborador-apps-busca"><Search size={15} /><input className="campo" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aplicativo..." aria-label="Buscar aplicativo" /></div>{appsFiltrados.length === 0 ? <p className="colaborador-vazio">Nenhum aplicativo encontrado.</p> : <div className="colaborador-apps-grade">{appsFiltrados.map((app) => <button key={app.id} type="button" className="colaborador-app" onClick={() => void abrirApp(app)} disabled={abrindoApp !== null}><AppWindow size={20} /><span>{app.nome}</span>{abrindoApp === app.id && <LoaderCircle size={14} className="girando" />}</button>)}</div>}</div>}
      </Modal>
    </>
  );
}
