import { useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AvisoFaixa, Botao, Campo } from "../../componentes/basicos";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { salvarAlteracaoPlanilha } from "./catalogoPlanilhasEmpresa";
import { planilhaPeloLink, type AlteracaoPlanilha, type PlanilhaCadastrada } from "./planilhasDaEmpresa";

type Edicao = Extract<AlteracaoPlanilha, { nome: string }>;

const erros: Record<string, string> = {
  planilha_empresa_duplicada: "Este arquivo já está cadastrado.",
  planilha_empresa_invalida: "Informe um nome e um link compartilhado do Google Planilhas.",
  planilha_empresa_nao_encontrada: "Esta planilha foi removida. Recarregue a lista e tente novamente.",
};

export function GerenciarPlanilhasEmpresa({ token, planilhas }: { token: string; planilhas: PlanilhaCadastrada[] }) {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [remocao, setRemocao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const emEnvio = useRef(false);

  function editar(item: Edicao) {
    setRemocao(null);
    setErro("");
    setEdicao(item);
  }

  async function aplicar(alteracao: AlteracaoPlanilha) {
    if (emEnvio.current) return;
    setErro("");
    if (alteracao.acao !== "remover") {
      const link = planilhaPeloLink(alteracao.nome.trim(), alteracao.url);
      if (!link || !link.nome) return setErro(erros.planilha_empresa_invalida);
      if (planilhas.some((item) => item.id !== alteracao.id && planilhaPeloLink(item.nome, item.url)?.id === link.id)) {
        return setErro(erros.planilha_empresa_duplicada);
      }
    }
    emEnvio.current = true;
    setSalvando(true);
    try {
      await salvarAlteracaoPlanilha(token, alteracao);
      if (useAuth.getState().token !== token) return;
      setEdicao(null);
      setRemocao(null);
      useInterface.getState().avisar(alteracao.acao === "remover" ? "Planilha removida." : "Planilha salva.", undefined, "sucesso");
    } catch (falha) {
      setErro(falha instanceof Error && Object.hasOwn(erros, falha.message)
        ? erros[falha.message] : "Não foi possível salvar a alteração. Tente novamente.");
    } finally {
      emEnvio.current = false;
      setSalvando(false);
    }
  }

  return <div className="planilhas-empresa-gerencia">
    <div className="planilhas-empresa-acoes">
      <Botao variante="primario" icone={<Plus size={15} />} disabled={salvando} onClick={() => editar({
        acao: "adicionar", id: `kyro:${crypto.randomUUID()}`, origemRobo: false, nome: "", url: "", ativa: true,
      })}>Adicionar planilha</Botao>
    </div>
    {edicao && <form className="planilhas-empresa-cartao" aria-label={edicao.acao === "adicionar" ? "Nova planilha" : "Editar planilha"}
      onSubmit={(evento) => { evento.preventDefault(); void aplicar(edicao); }}>
      <Campo rotulo="Nome" id="planilha-empresa-nome" obrigatorio>
        <input id="planilha-empresa-nome" className="campo" autoFocus required maxLength={120} disabled={salvando}
          value={edicao.nome} onChange={(evento) => setEdicao({ ...edicao, nome: evento.target.value })} />
      </Campo>
      <Campo rotulo="Link compartilhado" id="planilha-empresa-link" obrigatorio>
        <input id="planilha-empresa-link" className="campo" type="url" required maxLength={4096} disabled={salvando}
          value={edicao.url} onChange={(evento) => setEdicao({ ...edicao, url: evento.target.value })} />
      </Campo>
      <div className="planilhas-empresa-acoes">
        <Botao disabled={salvando} onClick={() => { setEdicao(null); setErro(""); }}>Cancelar</Botao>
        <Botao type="submit" variante="primario" disabled={salvando}>{salvando ? "Salvando…" : "Salvar planilha"}</Botao>
      </div>
    </form>}
    {erro && <AvisoFaixa tipo="erro"><span role="alert">{erro}</span></AvisoFaixa>}
    {planilhas.length ? <ul className="planilhas-empresa-cartao planilhas-empresa-lista">
      {planilhas.map((item) => <li key={item.id}>
        <div className="planilhas-empresa-identificacao">
          <strong>{item.nome}</strong>
          <span>{item.ativa ? "Ativa" : "Inativa"}{item.origemRobo ? " · Robô de Aderências" : ""}</span>
        </div>
        <div className="planilhas-empresa-acoes">
          <Botao pequeno icone={<Pencil size={15} />} disabled={salvando} aria-label={`Editar ${item.nome}`}
            onClick={() => editar({ ...item, acao: "salvar" })}>Editar</Botao>
          <Botao pequeno disabled={salvando || !!edicao || !!remocao} aria-label={`${item.ativa ? "Inativar" : "Reativar"} ${item.nome}`}
            onClick={() => void aplicar({ ...item, acao: "salvar", ativa: !item.ativa })}>{item.ativa ? "Inativar" : "Reativar"}</Botao>
          <Botao pequeno disabled={salvando} icone={<Trash2 size={15} />} aria-label={`Remover ${item.nome}`}
            onClick={() => { setEdicao(null); setErro(""); setRemocao(item.id); }}>Remover</Botao>
        </div>
        {remocao === item.id && <div className="planilhas-empresa-confirmacao">
          <p>Remover <strong>{item.nome}</strong> do catálogo do Kyro?</p>
          <div className="planilhas-empresa-acoes">
            <Botao pequeno disabled={salvando} onClick={() => { setRemocao(null); setErro(""); }}>Cancelar</Botao>
            <Botao pequeno disabled={salvando} variante="perigo" onClick={() => void aplicar({ id: item.id, origemRobo: item.origemRobo, acao: "remover" })}>Confirmar remoção</Botao>
          </div>
        </div>}
      </li>)}
    </ul> : <p>Nenhuma planilha cadastrada.</p>}
  </div>;
}
