import { useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { AvisoFaixa, Vazio } from "../../componentes/basicos";
import { Marca } from "../../marcas/Marca";
import { conexoesPonte } from "../../ponte/conexoesReais";
import { mensagemDeErroDaConexao } from "../../utilitarios/errosDeConexao";
import { contem } from "../../utilitarios/basicos";
import { Tabela } from "./pecasDaJanela";
import type { DadosPlanilhasGoogle, PlanilhaGoogle } from "../../tiposPlanilhas";
import "./planilhasGoogle.css";

function PlanilhaEmConsulta({ planilha, filtro }: { planilha: PlanilhaGoogle; filtro: string }) {
  const [selecionada, setSelecionada] = useState(planilha);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const requisicao = useRef(0);
  useEffect(() => {
    requisicao.current++;
    setSelecionada(planilha); setCarregando(false); setErro("");
    return () => { requisicao.current++; };
  }, [planilha]);

  const trocarAba = async (gid: number) => {
    const versao = ++requisicao.current;
    setCarregando(true); setErro("");
    try {
      const dados = await conexoesPonte.lerAbaPlanilha(planilha.id, gid);
      if (versao === requisicao.current) setSelecionada(dados);
    } catch (e) {
      if (versao === requisicao.current && (e as Error).message !== "conexao_sessao_alterada") setErro(mensagemDeErroDaConexao((e as Error).message));
    } finally { if (versao === requisicao.current) setCarregando(false); }
  };
  const previa = selecionada.previa;
  const linhas = previa?.valores.map((celulas, i) => ({ numero: i + 1, celulas })) ?? [];
  const quantidadeColunas = Math.max(1, ...linhas.map((l) => l.celulas.length));
  return <article className="pg-documento" aria-label={planilha.titulo} aria-busy={carregando}>
    <header className="pg-cabecalho"><span className="pg-logo"><Marca marca="planilhas" tamanho={23} /></span><div><h3>{planilha.titulo}</h3><span>{planilha.abas.length ? planilha.abas.length === 1 ? "1 aba disponível" : `${planilha.abas.length} abas disponíveis` : "Acesso à planilha"}</span></div><a className="pg-abrir" href={selecionada.link} target="_blank" rel="noopener noreferrer">Abrir no Google<ExternalLink size={13} aria-hidden="true" /></a></header>
    {selecionada.erro ? <AvisoFaixa><span>{mensagemDeErroDaConexao(selecionada.erro)}</span></AvisoFaixa> : <>
      <label className="pg-seletor"><span>Consultar aba</span><select className="seletor" value={previa?.abaId ?? ""} onChange={(e) => void trocarAba(Number(e.target.value))}>{planilha.abas.map((aba) => <option key={aba.id} value={aba.id}>{aba.titulo}</option>)}</select>{carregando && <span className="pg-carregando" role="status"><LoaderCircle size={14} className="girando" aria-hidden="true" /> Consultando</span>}</label>
      {erro && <AvisoFaixa tipo="erro"><span role="alert">{erro}</span></AvisoFaixa>}
      {previa && <p className="pg-contexto">Prévia em leitura de até 100 linhas e 20 colunas. As letras e os números indicam as posições originais das células.{previa.limitada ? " Abra no Google para consultar a planilha completa." : ""}</p>}
      {linhas.length === 0 ? <Vazio titulo="Nenhum valor neste intervalo" texto="A aba foi consultada e não tem dados nas primeiras 100 linhas e 20 colunas." /> : <div className="pg-tabela" role="region" aria-label={`Dados da aba ${previa?.aba}`} tabIndex={0}>
        <p className="pg-dica-rolagem">Deslize a tabela para ver as outras colunas.</p>
        <Tabela filtro={filtro} linhas={linhas} colunas={[
          { titulo: "Linha", render: (l) => l.numero, texto: (l) => String(l.numero) },
          ...Array.from({ length: quantidadeColunas }, (_, i) => ({ titulo: String.fromCharCode(65 + i), render: (l: typeof linhas[number]) => <span className="pg-celula privado" title={l.celulas[i] ?? ""}>{l.celulas[i] ?? ""}</span>, texto: (l: typeof linhas[number]) => l.celulas[i] ?? "" })),
        ]} />
      </div>}
    </>}
  </article>;
}

export function ConteudoPlanilhas({ dados, filtro }: { dados: DadosPlanilhasGoogle; filtro: string }) {
  return <section className="planilhas-conteudo" aria-label="Dados do Google Planilhas">
    <p className="pg-contexto">Acompanhe as planilhas selecionadas. Para editar células ou fórmulas, use Abrir no Google.</p>
    {dados.planilhas.length === 0 ? <Vazio titulo="Nenhuma planilha configurada" /> : dados.planilhas.map((planilha, i) => <PlanilhaEmConsulta key={`${planilha.id}:${i}`} planilha={planilha} filtro={contem(planilha.titulo, filtro) ? "" : filtro} />)}
  </section>;
}
