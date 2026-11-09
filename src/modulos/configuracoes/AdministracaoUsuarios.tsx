import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, FileSpreadsheet, LoaderCircle, MailPlus, Pencil, RefreshCw, Save, ShieldCheck, UserCheck, UserCog, UserX, X } from "lucide-react";
import { Botao, Campo, AvisoFaixa } from "../../componentes/basicos";
import { cabecalhosNiko, useAuth, urlApi } from "../../estado/autenticacao";

interface UsuarioAdministrado {
  id: number;
  email: string;
  nome: string;
  ativo: boolean;
  perfil: "dono" | "adm" | "colaborador";
  robo_aderencias: boolean;
  cargo?: string | null;
  setor?: string | null;
  telefone?: string | null;
}

interface ConvitePendente {
  email: string;
  nome: string;
  cargo?: string | null;
  setor?: string | null;
  telefone?: string | null;
  perfil?: "adm" | "colaborador" | null;
  expira_em: string;
}

async function respostaJson(res: Response): Promise<Record<string, unknown>> {
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof dados.erro === "string" ? dados.erro : "Não foi possível concluir a operação.");
  return dados as Record<string, unknown>;
}

function mensagemDoConvite(erro: string) {
  const mensagens: Record<string, string> = {
    email_nao_configurado: "O envio de e-mail ainda não está configurado no servidor.",
    email_nao_enviado: "O convite não foi enviado. Confira o remetente e a configuração do serviço de e-mail.",
    url_publica_nao_configurada: "A URL pública do Kyro não está configurada no servidor.",
    email_invalido: "Informe um e-mail válido.",
    nome_obrigatorio: "Informe o nome da pessoa.",
    usuario_ja_cadastrado: "Esse e-mail já possui uma conta no Kyro.",
    convite_nao_encontrado: "Esse convite não está mais pendente.",
  };
  return mensagens[erro] ?? erro;
}

export function AdministracaoUsuarios() {
  const token = useAuth((s) => s.token);
  const usuario = useAuth((s) => s.usuario);
  const [usuarios, setUsuarios] = useState<UsuarioAdministrado[]>([]);
  const [convites, setConvites] = useState<ConvitePendente[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState("");
  const [telefone, setTelefone] = useState("");
  const [papel, setPapel] = useState<"adm" | "colaborador">("colaborador");
  const [papelEdicao, setPapelEdicao] = useState<"adm" | "colaborador">("colaborador");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const headers = { ...cabecalhosNiko(), Authorization: `Bearer ${token ?? ""}` };

  const carregar = useCallback(async () => {
    if (!token || usuario?.perfil !== "dono") return;
    setCarregando(true);
    setErro("");
    try {
      const [dados, convitesDados] = await Promise.all([
        respostaJson(await fetch(urlApi("/api/auth?acao=usuarios"), { headers })),
        respostaJson(await fetch(urlApi("/api/auth?acao=convites"), { headers })),
      ]);
      setUsuarios(Array.isArray(dados.usuarios) ? dados.usuarios as UsuarioAdministrado[] : []);
      setConvites(Array.isArray(convitesDados.convites) ? convitesDados.convites as ConvitePendente[] : []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  }, [token, usuario?.perfil]);

  useEffect(() => { void carregar(); }, [carregar]);

  const enviarConvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !nome.trim() || enviando) return;
    setEnviando(true);
    setErro("");
    setMensagem("");
    try {
      const dados = await respostaJson(await fetch(urlApi("/api/auth?acao=convite"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), email: email.trim(), perfil: papel, cargo: cargo.trim(), setor: setor.trim(), telefone: telefone.trim() }),
      }));
      setMensagem(typeof dados.mensagem === "string" ? dados.mensagem : "Convite enviado.");
      setNome("");
      setEmail("");
      setCargo("");
      setSetor("");
      setTelefone("");
      setPapel("colaborador");
      void carregar();
    } catch (e) {
      setErro(mensagemDoConvite(e instanceof Error ? e.message : "Não foi possível enviar o convite."));
    } finally {
      setEnviando(false);
    }
  };

  const alterarConvite = async (convite: ConvitePendente, operacao: "reenviar" | "cancelar") => {
    setErro("");
    setMensagem("");
    try {
      const dados = await respostaJson(await fetch(urlApi("/api/auth?acao=convite"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ operacao, email: convite.email }),
      }));
      setMensagem(typeof dados.mensagem === "string" ? dados.mensagem : operacao === "reenviar" ? "Convite reenviado." : "Convite cancelado.");
      await carregar();
    } catch (e) {
      setErro(mensagemDoConvite(e instanceof Error ? e.message : "Não foi possível alterar o convite."));
    }
  };

  const alterarAtivo = async (alvo: UsuarioAdministrado) => {
    setErro("");
    setMensagem("");
    try {
      const dados = await respostaJson(await fetch(urlApi("/api/auth?acao=usuario"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: alvo.id, ativo: !alvo.ativo }),
      }));
      const atualizado = dados.usuario as UsuarioAdministrado;
      setUsuarios((atuais) => atuais.map((item) => item.id === atualizado.id ? atualizado : item));
      setMensagem(atualizado.ativo ? `${atualizado.nome} foi reativado.` : `${atualizado.nome} foi desativado.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar o acesso.");
    }
  };

  const alterarAcessoAderencias = async (alvo: UsuarioAdministrado) => {
    setErro("");
    setMensagem("");
    try {
      const dados = await respostaJson(await fetch(urlApi("/api/auth?acao=usuario"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: alvo.id, roboAderencias: !alvo.robo_aderencias }),
      }));
      const atualizado = dados.usuario as UsuarioAdministrado;
      setUsuarios((atuais) => atuais.map((item) => item.id === atualizado.id ? atualizado : item));
      setMensagem(atualizado.robo_aderencias ? `${atualizado.nome} recebeu acesso ao Robô de Aderências.` : `O acesso de ${atualizado.nome} ao Robô de Aderências foi removido.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar a permissão do robô.");
    }
  };

  const iniciarEdicao = (alvo: UsuarioAdministrado) => {
    setEditandoId(alvo.id);
    setCargo(alvo.cargo ?? "");
    setSetor(alvo.setor ?? "");
    setTelefone(alvo.telefone ?? "");
    setPapelEdicao(alvo.perfil === "adm" ? "adm" : "colaborador");
    setErro("");
    setMensagem("");
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setCargo("");
    setSetor("");
    setTelefone("");
    setPapelEdicao("colaborador");
  };

  const salvarPerfil = async (e: FormEvent) => {
    e.preventDefault();
    if (!editandoId || salvandoPerfil) return;
    setSalvandoPerfil(true);
    setErro("");
    setMensagem("");
    try {
      const dados = await respostaJson(await fetch(urlApi("/api/auth?acao=usuario"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: editandoId, perfilProfissional: true, perfil: papelEdicao, cargo: cargo.trim(), setor: setor.trim(), telefone: telefone.trim() }),
      }));
      const atualizado = dados.usuario as UsuarioAdministrado;
      setUsuarios((atuais) => atuais.map((item) => item.id === atualizado.id ? atualizado : item));
      setMensagem(`Perfil profissional de ${atualizado.nome} atualizado.`);
      cancelarEdicao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o perfil profissional.");
    } finally {
      setSalvandoPerfil(false);
    }
  };

  return (
    <div className="admin-usuarios">
      <div className="admin-usuarios-cabecalho">
        <div className="admin-usuarios-titulo">
          <span className="admin-usuarios-icone"><UserCog size={18} /></span>
          <div>
            <h3>Controle de acesso</h3>
            <p>Convide pessoas autorizadas e mantenha o acesso sob controle.</p>
          </div>
        </div>
        <Botao pequeno icone={<RefreshCw size={13} />} onClick={() => void carregar()} disabled={carregando}>Atualizar</Botao>
      </div>

      <AvisoFaixa tipo="info">
        O Pablo é o proprietário da conta e não pode ser excluído, desativado ou removido por esta tela.
      </AvisoFaixa>

      <form className="admin-usuarios-convite" onSubmit={enviarConvite}>
        <div className="admin-usuarios-secao-cabecalho">
          <div><strong>Adicionar usuário</strong><span>O convite expira em 48 horas e a pessoa cria a própria senha.</span></div>
          <MailPlus size={17} />
        </div>
        <div className="admin-usuarios-campos">
          <Campo id="admin-nome" rotulo="Nome" obrigatorio>
            <input id="admin-nome" className="campo" value={nome} maxLength={160} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
          </Campo>
          <Campo id="admin-email" rotulo="E-mail autorizado" obrigatorio>
            <input id="admin-email" className="campo" type="email" value={email} maxLength={320} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Campo>
          <Campo id="admin-perfil" rotulo="Acesso">
            <select id="admin-perfil" className="seletor campo" value={papel} onChange={(e) => setPapel(e.target.value as "adm" | "colaborador")}>
              <option value="colaborador">Colaborador — painel da empresa</option>
              <option value="adm">Administrador — área da empresa</option>
            </select>
          </Campo>
          <Campo id="admin-cargo" rotulo="Cargo">
            <input id="admin-cargo" className="campo" value={cargo} maxLength={120} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Coordenador" autoComplete="organization-title" />
          </Campo>
          <Campo id="admin-setor" rotulo="Setor">
            <input id="admin-setor" className="campo" value={setor} maxLength={120} onChange={(e) => setSetor(e.target.value)} placeholder="Ex.: Financeiro" autoComplete="organization" />
          </Campo>
          <Campo id="admin-telefone" rotulo="Telefone">
            <input id="admin-telefone" className="campo" type="tel" value={telefone} maxLength={40} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" autoComplete="tel" />
          </Campo>
        </div>
        <div className="admin-usuarios-rodape-form">
          <span><ShieldCheck size={13} /> A senha nunca passa pelo Pablo.</span>
          <Botao type="submit" variante="primario" icone={enviando ? <LoaderCircle size={14} className="girando" /> : <MailPlus size={14} />} disabled={enviando || !nome.trim() || !email.trim()}>
            {enviando ? "Enviando..." : "Enviar convite"}
          </Botao>
        </div>
      </form>

      {mensagem && <div className="admin-usuarios-sucesso" role="status"><Check size={15} /> {mensagem}</div>}
      {erro && <div className="admin-usuarios-erro" role="alert">{erro}</div>}

      {convites.length > 0 && (
        <div className="admin-usuarios-lista admin-usuarios-convites-pendentes">
          <div className="admin-usuarios-lista-cabecalho"><strong>Convites pendentes</strong><span>{convites.length}</span></div>
          {convites.map((convite) => (
            <div className="admin-usuarios-convite-pendente" key={convite.email}>
              <div className="admin-usuarios-convite-pendente-identidade">
                <strong>{convite.nome || convite.email}</strong>
                <span>{convite.email}</span>
                {(convite.cargo || convite.setor) && <small>{[convite.cargo, convite.setor].filter(Boolean).join(" · ")}</small>}
              </div>
              <span className="admin-usuarios-convite-expira">Expira em {new Date(convite.expira_em).toLocaleDateString("pt-BR")}</span>
              <Botao pequeno variante="secundario" onClick={() => void alterarConvite(convite, "reenviar")}>Reenviar</Botao>
              <Botao pequeno variante="fantasma" onClick={() => void alterarConvite(convite, "cancelar")}>Cancelar</Botao>
            </div>
          ))}
        </div>
      )}

      <div className="admin-usuarios-lista">
        <div className="admin-usuarios-lista-cabecalho"><strong>Contas autorizadas</strong><span>{usuarios.length} {usuarios.length === 1 ? "conta" : "contas"}</span></div>
        {carregando && <div className="admin-usuarios-carregando"><LoaderCircle size={16} className="girando" /> Carregando contas...</div>}
        {!carregando && usuarios.map((item) => (
          <div className="admin-usuarios-item" key={item.id}>
            <div className="admin-usuarios-item-principal">
              <div className="admin-usuarios-avatar">{item.nome.trim().slice(0, 1).toUpperCase() || "K"}</div>
              <div className="admin-usuarios-identidade">
                <strong>{item.nome}</strong>
                <span>{item.email}</span>
                {(item.cargo || item.setor || item.telefone) && <small>{[item.cargo, item.setor].filter(Boolean).join(" · ")}{item.telefone ? ` · ${item.telefone}` : ""}</small>}
              </div>
              <span className={`admin-usuarios-status ${item.ativo ? "ativo" : "inativo"}`}><i /> {item.ativo ? "Ativo" : "Desativado"}</span>
              {item.perfil === "dono" ? (
                <><span className="admin-usuarios-proprietario"><ShieldCheck size={13} /> Proprietário</span><span className="admin-usuarios-proprietario"><FileSpreadsheet size={13} /> Robô liberado</span></>
              ) : (
                <>
                  <span className="admin-usuarios-proprietario">{item.perfil === "adm" ? "Administrador" : "Colaborador"}</span>
                  <Botao pequeno variante={item.robo_aderencias ? "primario" : "secundario"} icone={<FileSpreadsheet size={13} />} onClick={() => void alterarAcessoAderencias(item)}>
                    {item.robo_aderencias ? "Robô liberado" : "Liberar robô"}
                  </Botao>
                  <Botao pequeno variante={item.ativo ? "secundario" : "primario"} icone={item.ativo ? <UserX size={13} /> : <UserCheck size={13} />} onClick={() => void alterarAtivo(item)}>
                    {item.ativo ? "Desativar" : "Reativar"}
                  </Botao>
                </>
              )}
              <Botao pequeno variante="fantasma" icone={<Pencil size={13} />} onClick={() => editandoId === item.id ? cancelarEdicao() : iniciarEdicao(item)}>
                {editandoId === item.id ? "Fechar" : "Editar perfil"}
              </Botao>
            </div>
            {editandoId === item.id && (
              <form className="admin-usuarios-edicao" onSubmit={salvarPerfil}>
                <div className="admin-usuarios-edicao-cabecalho"><strong>Perfil profissional</strong><span>Esses dados ficam visíveis no ambiente da empresa.</span></div>
                <div className="admin-usuarios-campos">
                  <Campo id={`admin-editar-perfil-${item.id}`} rotulo="Acesso">
                    <select id={`admin-editar-perfil-${item.id}`} className="seletor campo" value={papelEdicao} onChange={(e) => setPapelEdicao(e.target.value as "adm" | "colaborador")}>
                      <option value="colaborador">Colaborador — painel da empresa</option>
                      <option value="adm">Administrador — área da empresa</option>
                    </select>
                  </Campo>
                  <Campo id={`admin-editar-cargo-${item.id}`} rotulo="Cargo">
                    <input id={`admin-editar-cargo-${item.id}`} className="campo" value={cargo} maxLength={120} onChange={(e) => setCargo(e.target.value)} />
                  </Campo>
                  <Campo id={`admin-editar-setor-${item.id}`} rotulo="Setor">
                    <input id={`admin-editar-setor-${item.id}`} className="campo" value={setor} maxLength={120} onChange={(e) => setSetor(e.target.value)} />
                  </Campo>
                  <Campo id={`admin-editar-telefone-${item.id}`} rotulo="Telefone">
                    <input id={`admin-editar-telefone-${item.id}`} className="campo" type="tel" value={telefone} maxLength={40} onChange={(e) => setTelefone(e.target.value)} />
                  </Campo>
                </div>
                <div className="admin-usuarios-edicao-acoes">
                  <Botao pequeno variante="fantasma" type="button" icone={<X size={13} />} onClick={cancelarEdicao}>Cancelar</Botao>
                  <Botao pequeno variante="primario" type="submit" icone={salvandoPerfil ? <LoaderCircle size={13} className="girando" /> : <Save size={13} />} disabled={salvandoPerfil}>
                    {salvandoPerfil ? "Salvando..." : "Salvar perfil"}
                  </Botao>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
