import { useState, type FormEvent } from "react";
import { Pencil, Plus } from "lucide-react";
import { AvisoFaixa, Botao, Campo } from "../../componentes/basicos";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { gerarId } from "../../utilitarios/basicos";
import type { AplicativoEmpresa } from "./aplicativosEmpresaConfig";
import { carregarCatalogoAppsEmpresa, ErroAppsEmpresa, salvarAppEmpresa, useCatalogoAppsEmpresa } from "./catalogoAppsEmpresa";
import "./gerenciarAplicativosEmpresa.css";

type Edicao = Omit<AplicativoEmpresa, "id"> & { id: string | null; criacaoId?: string };

export function GerenciarAplicativosEmpresa() {
  const token = useAuth((s) => s.token);
  const { aplicativos, pronto, erro } = useCatalogoAppsEmpresa();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroEdicao, setErroEdicao] = useState("");

  function abrirEdicao(app?: AplicativoEmpresa) {
    setErroEdicao("");
    setEdicao(app ?? { id: null, criacaoId: gerarId(), nome: "", url: "", descricao: "", status: "disponivel", publico: false });
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!token || !edicao || salvando) return;
    setSalvando(true);
    setErroEdicao("");
    try {
      await salvarAppEmpresa(token, edicao);
      setEdicao(null);
      useInterface.getState().avisar(edicao.id ? "Aplicativo atualizado." : "Aplicativo adicionado ao menu.", undefined, "sucesso");
    } catch (falha) {
      setErroEdicao(falha instanceof ErroAppsEmpresa && falha.message === "aplicativo_invalido"
        ? "Preencha o nome e informe um endereço válido com http:// ou https://."
        : "Não foi possível salvar o aplicativo. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return <>
    <CabecalhoAba titulo="Gerenciar aplicativos" subtitulo="Edite os links da empresa e adicione aplicativos ao menu." />
    <section className="gerenciar-apps" aria-label="Catálogo de aplicativos">
      {!pronto && !erro && <p role="status">Carregando aplicativos…</p>}
      {erro && <AvisoFaixa tipo="alerta">
        Não foi possível atualizar o catálogo.{" "}
        <Botao pequeno disabled={!token} onClick={() => { if (token) void carregarCatalogoAppsEmpresa(token); }}>Tentar novamente</Botao>
      </AvisoFaixa>}
      {pronto && <div className="gerenciar-apps-acoes">
        <Botao variante="primario" icone={<Plus size={16} />} disabled={salvando} onClick={() => abrirEdicao()}>Adicionar aplicativo</Botao>
      </div>}
      {edicao && <form className="gerenciar-apps-form" onSubmit={salvar} aria-labelledby="gerenciar-apps-titulo">
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
            <select id="gerenciar-app-status" className="campo" value={edicao.status} onChange={(e) => setEdicao({ ...edicao, status: e.target.value === "manutencao" ? "manutencao" : "disponivel" })}>
              <option value="disponivel">Disponível</option>
              <option value="manutencao">Em manutenção</option>
            </select>
          </Campo>
          <label className="gerenciar-apps-publico"><input type="checkbox" checked={edicao.publico} onChange={(e) => setEdicao({ ...edicao, publico: e.target.checked })} />Mostrar no portal público</label>
        </fieldset>
        {erroEdicao && <AvisoFaixa tipo="alerta">{erroEdicao}</AvisoFaixa>}
        <div className="gerenciar-apps-acoes">
          <Botao disabled={salvando} onClick={() => setEdicao(null)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar aplicativo"}</Botao>
        </div>
      </form>}
      {pronto && <ul className="gerenciar-apps-lista">
        {aplicativos.map((app) => <li key={app.id}>
          <div><strong>{app.nome}</strong><span>{app.url ?? "Sem link cadastrado"}</span></div>
          <small>{app.status === "manutencao" ? "Em manutenção" : "Disponível"} · {app.publico ? "Público" : "Interno"}</small>
          <Botao pequeno disabled={salvando} aria-label={`Editar ${app.nome}`} icone={<Pencil size={14} />} onClick={() => abrirEdicao(app)}>Editar</Botao>
        </li>)}
      </ul>}
    </section>
  </>;
}
