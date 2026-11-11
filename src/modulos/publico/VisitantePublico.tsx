import { useState } from "react";
import type { FormEvent } from "react";
import { AppWindow, ArrowUpRight, CheckCircle2, LoaderCircle, PackageOpen } from "lucide-react";
import { AvisoFaixa, Botao, Campo } from "../../componentes/basicos";
import { urlApi } from "../../estado/autenticacao";
import { APLICATIVOS_EMPRESA } from "../escritorio/aplicativosEmpresaConfig";

export default function VisitantePublico() {
  const appInicial = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("app") === "materiais" ? "materiais" : "";
  const [app, setApp] = useState(appInicial);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [material, setMaterial] = useState("");
  const [variacao, setVariacao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [erro, setErro] = useState("");

  const solicitarMaterial = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const resposta = await fetch(urlApi("/api/solicitacoes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publico: true, visitanteNome: nome, visitanteEmail: email, materialId: material.toLocaleLowerCase().replace(/\s+/g, "-").slice(0, 120), materialNome: material, variacao, quantidade: Number(quantidade), observacao }),
      });
      const dados = await resposta.json().catch(() => ({})) as { protocolo?: string; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível enviar a solicitação.");
      setProtocolo(dados.protocolo || "registrado");
      setMaterial("");
      setVariacao("");
      setQuantidade("1");
      setObservacao("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a solicitação.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="visitante-publico">
      <header className="visitante-cabecalho"><div className="visitante-marca"><span className="visitante-marca-simbolo">K</span><span>Kyro</span></div><span className="visitante-etiqueta">PORTAL DA EMPRESA</span></header>
      <section className="visitante-introducao"><span className="visitante-kicker">ACESSO PÚBLICO</span><h1>Escolha o sistema que você precisa.</h1><p>Entre diretamente no aplicativo da empresa. Não é necessário criar uma conta no Kyro.</p></section>
      <section className="visitante-apps" aria-label="Sistemas da empresa">
        {APLICATIVOS_EMPRESA.map((item) => <button type="button" className={`visitante-app ${app === item.id ? "selecionado" : ""}`} key={item.id} onClick={() => item.id === "materiais" ? setApp("materiais") : item.url ? window.location.assign(item.url) : undefined} disabled={!item.url && item.id !== "materiais"}><span className="visitante-app-icone"><AppWindow size={20} /></span><span><strong>{item.nome}</strong><small>{item.descricao}</small></span><ArrowUpRight size={16} /></button>)}
      </section>
      {app === "materiais" && <section className="visitante-material" aria-label="Solicitar material"><div className="visitante-material-cabecalho"><span className="visitante-app-icone"><PackageOpen size={20} /></span><div><span className="visitante-kicker">SOLICITAÇÃO DE MATERIAIS</span><h2>Faça seu pedido</h2><p>Preencha os dados para a empresa analisar sua solicitação.</p></div></div>{protocolo ? <div className="visitante-sucesso"><CheckCircle2 size={28} /><h3>Solicitação enviada</h3><p>Guarde este protocolo para acompanhar o pedido.</p><code>{protocolo}</code><Botao variante="primario" onClick={() => setProtocolo("")}>Fazer outra solicitação</Botao></div> : <form className="visitante-formulario" onSubmit={(e) => void solicitarMaterial(e)}><div className="visitante-formulario-grade"><Campo id="visitante-nome" rotulo="Nome" obrigatorio><input id="visitante-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={160} required /></Campo><Campo id="visitante-email" rotulo="E-mail ou contato"><input id="visitante-email" className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} /></Campo><Campo id="visitante-material" rotulo="Material solicitado" obrigatorio><input id="visitante-material" className="campo" value={material} onChange={(e) => setMaterial(e.target.value)} maxLength={160} required /></Campo><Campo id="visitante-variacao" rotulo="Tamanho ou código"><input id="visitante-variacao" className="campo" value={variacao} onChange={(e) => setVariacao(e.target.value)} maxLength={160} /></Campo><Campo id="visitante-quantidade" rotulo="Quantidade" obrigatorio><input id="visitante-quantidade" className="campo" type="number" min={1} max={99} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required /></Campo></div><Campo id="visitante-observacao" rotulo="Observação"><textarea id="visitante-observacao" className="campo" rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} /></Campo>{erro && <AvisoFaixa tipo="erro">{erro}</AvisoFaixa>}<div className="formulario-acoes"><Botao type="submit" variante="primario" disabled={enviando}>{enviando ? <><LoaderCircle size={14} className="girando" /> Enviando...</> : "Enviar solicitação"}</Botao></div></form>}</section>}
      <footer className="visitante-rodape">Acesso público · Kyro Empresa</footer>
    </main>
  );
}
