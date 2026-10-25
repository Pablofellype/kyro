import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, MailPlus, RefreshCw, ShieldCheck, UserCheck, UserCog, UserX } from "lucide-react";
import { Botao, Campo, AvisoFaixa } from "../../componentes/basicos";
import { cabecalhosNiko, useAuth, urlApi } from "../../estado/autenticacao";

interface UsuarioAdministrado {
  id: number;
  email: string;
  nome: string;
  ativo: boolean;
  perfil: "dono" | "usuario";
}

async function respostaJson(res: Response): Promise<Record<string, unknown>> {
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof dados.erro === "string" ? dados.erro : "Não foi possível concluir a operação.");
  return dados as Record<string, unknown>;
}

export function AdministracaoUsuarios() {
  const token = useAuth((s) => s.token);
  const usuario = useAuth((s) => s.usuario);
  const [usuarios, setUsuarios] = useState<UsuarioAdministrado[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const headers = { ...cabecalhosNiko(), Authorization: `Bearer ${token ?? ""}` };

  const carregar = useCallback(async () => {
    if (!token || usuario?.perfil !== "dono") return;
    setCarregando(true);
    setErro("");
    try {
      const dados = await respostaJson(await fetch(urlApi("/api/auth?acao=usuarios"), { headers }));
      setUsuarios(Array.isArray(dados.usuarios) ? dados.usuarios as UsuarioAdministrado[] : []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  }, [token, usuario?.perfil]);

  useEffect(() => { void carregar(); }, [carregar]);

  const enviarConvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !nome.trim() || enviando) return;
    setEnviando(true);
    setErro("");
    setMensagem("");
    try {
      const dados = await respostaJson(await fetch(urlApi("/api/auth?acao=convite"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), email: email.trim() }),
      }));
      setMensagem(typeof dados.mensagem === "string" ? dados.mensagem : "Convite enviado.");
      setNome("");
      setEmail("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o convite.");
    } finally {
      setEnviando(false);
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

      <div className="admin-usuarios-lista">
        <div className="admin-usuarios-lista-cabecalho"><strong>Contas autorizadas</strong><span>{usuarios.length} {usuarios.length === 1 ? "conta" : "contas"}</span></div>
        {carregando && <div className="admin-usuarios-carregando"><LoaderCircle size={16} className="girando" /> Carregando contas...</div>}
        {!carregando && usuarios.map((item) => (
          <div className="admin-usuarios-item" key={item.id}>
            <div className="admin-usuarios-avatar">{item.nome.trim().slice(0, 1).toUpperCase() || "K"}</div>
            <div className="admin-usuarios-identidade">
              <strong>{item.nome}</strong>
              <span>{item.email}</span>
            </div>
            <span className={`admin-usuarios-status ${item.ativo ? "ativo" : "inativo"}`}><i /> {item.ativo ? "Ativo" : "Desativado"}</span>
            {item.perfil === "dono" ? (
              <span className="admin-usuarios-proprietario"><ShieldCheck size={13} /> Proprietário</span>
            ) : (
              <Botao pequeno variante={item.ativo ? "secundario" : "primario"} icone={item.ativo ? <UserX size={13} /> : <UserCheck size={13} />} onClick={() => void alterarAtivo(item)}>
                {item.ativo ? "Desativar" : "Reativar"}
              </Botao>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
