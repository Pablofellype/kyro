import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, ArrowUpRight, Download, Eye, EyeOff, Globe2, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { cabecalhosNiko, useAuth, urlApi } from "../../estado/autenticacao";
import { Botao, Modal } from "../../componentes/basicos";
import { LogoNiko } from "../LogoNiko";
import { ModalInstalacao } from "./ModalInstalacao";
import { PreviaKyro } from "./PreviaKyro";
import manifesto from "../../../package.json";
import { jsonSeguro, mensagemDeErroApi } from "../../utilitarios/erroApi";
import "./login.css";
import "./entrada.css";

interface Props {
  aoSucesso?: () => void;
}

function mensagemDoErroDeAcesso(erro: string) {
  const mensagens: Record<string, string> = {
    token_invalido: "Este link de acesso está incompleto ou inválido.",
    token_expirado: "Este link expirou ou já foi usado. Peça ao administrador para enviar um novo convite.",
    email_nao_configurado: "O envio de e-mail ainda não está configurado no servidor.",
    email_nao_enviado: "Não foi possível enviar o e-mail agora. Verifique a configuração do servidor.",
  };
  return mensagens[erro] ?? erro;
}

export function TelaLogin({ aoSucesso }: Props) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState("");
  const [testandoConexao, setTestandoConexao] = useState(false);
  const [modalInstalacaoAberto, setModalInstalacaoAberto] = useState(false);
  const parametrosAcesso = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [fluxoAcesso, setFluxoAcesso] = useState<"recuperar" | "redefinir" | "convite" | null>(() => parametrosAcesso.get("convite") ? "convite" : parametrosAcesso.get("recuperar") ? "redefinir" : null);
  const [tokenAcesso] = useState(() => parametrosAcesso.get("convite") || parametrosAcesso.get("recuperar") || "");
  const [emailAcesso, setEmailAcesso] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaNovaConfirmacao, setSenhaNovaConfirmacao] = useState("");
  const [mensagemAcesso, setMensagemAcesso] = useState("");
  const [erroAcesso, setErroAcesso] = useState("");
  const [carregandoAcesso, setCarregandoAcesso] = useState(false);
  const [validandoAcesso, setValidandoAcesso] = useState(Boolean(tokenAcesso));
  const [acessoValido, setAcessoValido] = useState(!tokenAcesso);

  const definirUsuario = useAuth((s) => s.definirUsuario);

  useEffect(() => {
    if (!tokenAcesso) return;
    let ativo = true;
    setValidandoAcesso(true);
    setAcessoValido(false);
    void fetch(urlApi(`/api/auth?acao=validar-acesso&token=${encodeURIComponent(tokenAcesso)}`), { headers: cabecalhosNiko() })
      .then(async (res) => {
        const dados = await res.json().catch(() => ({})) as { acesso?: { email?: string }; erro?: string };
        if (!res.ok || !dados.acesso) throw new Error(dados.erro || "token_invalido");
        if (!ativo) return;
        setAcessoValido(true);
        if (dados.acesso.email && fluxoAcesso === "recuperar") setEmailAcesso(dados.acesso.email);
      })
      .catch((erroValidacao) => {
        if (!ativo) return;
        setAcessoValido(false);
        setErroAcesso(erroValidacao instanceof Error ? erroValidacao.message : "token_invalido");
      })
      .finally(() => { if (ativo) setValidandoAcesso(false); });
    return () => { ativo = false; };
  }, [tokenAcesso, fluxoAcesso]);

  const testarConexao = async () => {
    setTestandoConexao(true);
    setDiagnostico("");
    try {
      const res = await fetch(urlApi("/api/health"), { headers: cabecalhosNiko(), signal: AbortSignal.timeout(8000) });
      const dados = await jsonSeguro<{ banco?: string }>(res);
      setDiagnostico(res.ok ? "API e banco alcançáveis. Confira o e-mail e a senha se o acesso continuar falhando." : dados?.banco === "indisponivel" ? "A API respondeu, mas o banco de dados não respondeu. Tente novamente." : mensagemDeErroApi(undefined, res.status));
    } catch (e) {
      setDiagnostico(mensagemDeErroApi(e));
    } finally {
      setTestandoConexao(false);
    }
  };

  const abrirRecuperacao = () => {
    setEmailAcesso(email.trim());
    setMensagemAcesso("");
    setErroAcesso("");
    setFluxoAcesso("recuperar");
  };

  const solicitarRecuperacao = async (e: FormEvent) => {
    e.preventDefault();
    setMensagemAcesso("");
    setErroAcesso("");
    setCarregandoAcesso(true);
    try {
      const res = await fetch(urlApi("/api/auth?acao=recuperar"), { method: "POST", headers: { ...cabecalhosNiko(), "Content-Type": "application/json" }, body: JSON.stringify({ email: emailAcesso.trim() }) });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Não foi possível enviar o e-mail agora.");
      setMensagemAcesso(dados.mensagem || "Se o e-mail estiver autorizado, enviaremos um link para criar uma nova senha.");
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : "Não foi possível enviar o e-mail agora.");
    } finally {
      setCarregandoAcesso(false);
    }
  };

  const salvarNovaSenha = async (e: FormEvent) => {
    e.preventDefault();
    setMensagemAcesso("");
    setErroAcesso("");
    if (!tokenAcesso || !acessoValido) {
      setErroAcesso("Este link de acesso não é válido. Peça um novo convite ao administrador.");
      return;
    }
    if (senhaNova !== senhaNovaConfirmacao) {
      setErroAcesso("As senhas não são iguais.");
      return;
    }
    if (senhaNova.length < 10) {
      setErroAcesso("A senha precisa ter pelo menos 10 caracteres.");
      return;
    }
    setCarregandoAcesso(true);
    try {
      const res = await fetch(urlApi("/api/auth?acao=redefinir"), { method: "POST", headers: { ...cabecalhosNiko(), "Content-Type": "application/json" }, body: JSON.stringify({ token: tokenAcesso, senha: senhaNova }) });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Não foi possível definir a senha.");
      definirUsuario(dados.usuario, dados.token);
      setFluxoAcesso(null);
      aoSucesso?.();
      window.history.replaceState({}, "", window.location.pathname);
      window.location.reload();
    } catch (e) {
      setErroAcesso(e instanceof Error ? e.message : "Não foi possível definir a senha.");
    } finally {
      setCarregandoAcesso(false);
    }
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    const emailLimpo = email.trim();
    if (!emailLimpo || !senha) {
      setErro("Preencha seu e-mail e sua senha.");
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch(urlApi("/api/auth?acao=login"), { method: "POST", headers: { ...cabecalhosNiko(), "Content-Type": "application/json" }, body: JSON.stringify({ email: emailLimpo, senha }) });
      const dados = await jsonSeguro<{ sucesso?: boolean; erro?: string; usuario?: unknown; token?: string }>(res);
      if (!res.ok || !dados?.sucesso) {
        setErro(dados?.erro || mensagemDeErroApi(undefined, res.status));
        setCarregando(false);
        return;
      }
      definirUsuario(dados.usuario as Parameters<typeof definirUsuario>[0], dados.token);
      aoSucesso?.();
      window.location.reload();
    } catch (e) {
      setErro(mensagemDeErroApi(e));
    } finally {
      setCarregando(false);
    }
  };

  const abrirPortalVisitante = () => window.location.assign("/?visitante=1");

  return (
    <div className="estilo-sistema kyro-entrada">
      <div className="kyro-entrada-shell">
        <header className="kyro-entrada-topo">
          <a href="/" className="kyro-entrada-marca" aria-label="Kyro, início"><LogoNiko tamanho={36} brilho={false} /><span>kyro<span className="kyro-entrada-marca-ponto">.</span></span></a>
          <span className="kyro-entrada-assinatura">Seu mundo, bem organizado.</span>
          <button type="button" className="kyro-entrada-download" onClick={() => setModalInstalacaoAberto(true)}><Download size={15} /><span>Kyro para desktop</span><ArrowUpRight size={14} /></button>
        </header>

        <main className="kyro-entrada-principal">
          <section className="kyro-entrada-apresentacao" aria-labelledby="kyro-entrada-chamada">
            <div className="kyro-entrada-copy">
              <span className="kyro-entrada-kicker"><i /> PESSOAL. EMPRESA. CONECTADOS.</span>
              <h1 id="kyro-entrada-chamada">Tudo o que move <br />o seu dia<span>.</span></h1>
              <p>Seu tempo, sua equipe e seus aplicativos. <br />Finalmente, no mesmo lugar.</p>
            </div>
            <PreviaKyro />
          </section>

          <section className="kyro-entrada-acesso" aria-labelledby="kyro-entrada-titulo">
            <div className="kyro-entrada-acesso-intro"><span className="kyro-entrada-selo"><LockKeyhole size={13} /> ACESSO KYRO</span><h2 id="kyro-entrada-titulo">Entre.<br />Sinta-se em casa.</h2><p>O seu espaço está aqui.<br />Acesse com a sua conta para continuar.</p></div>
            <form className="kyro-entrada-form" onSubmit={submeter} aria-busy={carregando}>
              {erro && <div className="kyro-entrada-erro" role="alert"><AlertCircle size={16} /><span>{erro}</span></div>}
              {erro && <button type="button" className="kyro-entrada-diagnostico-botao" onClick={() => void testarConexao()} disabled={testandoConexao}>{testandoConexao ? "Testando conexão..." : "Testar conexão"}</button>}
              {diagnostico && <p className="kyro-entrada-diagnostico" role="status">{diagnostico}</p>}
              <label className="kyro-entrada-campo" htmlFor="kyro-entrada-email"><span>E-mail</span><div><Mail size={17} /><input id="kyro-entrada-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={carregando} required /></div></label>
              <label className="kyro-entrada-campo" htmlFor="kyro-entrada-senha"><span>Senha</span><div><LockKeyhole size={17} /><input id="kyro-entrada-senha" type={mostrarSenha ? "text" : "password"} placeholder="Sua senha de acesso" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" disabled={carregando} required /><button type="button" onClick={() => setMostrarSenha((valor) => !valor)} aria-label={mostrarSenha ? "Ocultar senha" : "Ver senha"} aria-pressed={mostrarSenha}>{mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
              <button type="button" className="kyro-entrada-esqueci" onClick={abrirRecuperacao} disabled={carregando}>Esqueceu a senha?</button>
              <button type="submit" className="kyro-entrada-submit" disabled={carregando}>{carregando ? <><span>Entrando...</span><LoaderCircle size={18} className="girando" /></> : <><span>Entrar no meu espaço</span><ArrowRight size={18} /></>}</button>
              <span className="kyro-entrada-protecao"><ShieldCheck size={13} /> Seu acesso. Suas permissões.</span>
            </form>
            <div className="kyro-entrada-visitante">
              <span>Veio acessar um sistema da empresa?</span>
              <button type="button" onClick={abrirPortalVisitante}><Globe2 size={19} /><span><strong>Continuar como visitante</strong><small>Sem conta. Direto ao que você precisa.</small></span><ArrowUpRight size={17} /></button>
            </div>
          </section>
        </main>

        <footer className="kyro-entrada-rodape"><span><span className="kyro-entrada-rodape-marca">k.</span> Mais espaço para o que importa.</span><span>KYRO <i /> v{manifesto.version}</span></footer>
      </div>

      <Modal aberto={!!fluxoAcesso} titulo={fluxoAcesso === "recuperar" ? "Recuperar acesso" : fluxoAcesso === "convite" ? "Ativar convite" : "Criar nova senha"} aoFechar={() => { if (carregandoAcesso) return; setFluxoAcesso(null); setMensagemAcesso(""); setErroAcesso(""); }}>
        {fluxoAcesso === "recuperar" ? (
          <form className="kyro-login-acesso-formulario" onSubmit={solicitarRecuperacao}>
            <div className="kyro-login-acesso-intro"><span className="kyro-login-acesso-kicker">ACESSO SEGURO</span><p>Informe o e-mail autorizado no Kyro. Enviaremos um link temporário para você criar uma nova senha.</p></div>
            <label className="kyro-login-acesso-campo" htmlFor="recuperacao-email"><span>E-MAIL DA CONTA</span><input id="recuperacao-email" type="email" className="campo" value={emailAcesso} onChange={(e) => setEmailAcesso(e.target.value)} autoComplete="email" required /></label>
            {mensagemAcesso && <div className="kyro-login-acesso-mensagem" role="status">{mensagemAcesso}</div>}
            {erroAcesso && <div className="kyro-login-acesso-erro" role="alert"><AlertCircle size={15} /> {mensagemDoErroDeAcesso(erroAcesso)}</div>}
            <div className="kyro-login-acesso-acoes"><Botao type="button" onClick={() => setFluxoAcesso(null)} disabled={carregandoAcesso}>Voltar</Botao><Botao type="submit" variante="primario" disabled={carregandoAcesso || !emailAcesso.trim()}>{carregandoAcesso ? <LoaderCircle size={15} className="girando" /> : "Enviar link"}</Botao></div>
          </form>
        ) : (
          <form className="kyro-login-acesso-formulario" onSubmit={salvarNovaSenha}>
            <div className="kyro-login-acesso-intro"><span className="kyro-login-acesso-kicker">{fluxoAcesso === "convite" ? "CONVITE KYRO" : "LINK TEMPORÁRIO"}</span><p>{fluxoAcesso === "convite" ? "Defina sua senha para ativar o acesso autorizado ao sistema." : "Escolha uma senha forte para proteger sua conta."}</p></div>
            <label className="kyro-login-acesso-campo" htmlFor="nova-senha"><span>NOVA SENHA</span><input id="nova-senha" type="password" className="campo" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} autoComplete="new-password" minLength={10} required /></label>
            <label className="kyro-login-acesso-campo" htmlFor="confirmar-senha"><span>CONFIRMAR SENHA</span><input id="confirmar-senha" type="password" className="campo" value={senhaNovaConfirmacao} onChange={(e) => setSenhaNovaConfirmacao(e.target.value)} autoComplete="new-password" minLength={10} required /></label>
            {mensagemAcesso && <div className="kyro-login-acesso-mensagem" role="status">{mensagemAcesso}</div>}
            {validandoAcesso && <div className="kyro-login-acesso-mensagem" role="status">Verificando o link de acesso...</div>}
            {erroAcesso && <div className="kyro-login-acesso-erro" role="alert"><AlertCircle size={15} /> {mensagemDoErroDeAcesso(erroAcesso)}</div>}
            <div className="kyro-login-acesso-acoes"><Botao type="button" onClick={() => setFluxoAcesso(null)} disabled={carregandoAcesso}>Cancelar</Botao><Botao type="submit" variante="primario" disabled={carregandoAcesso || validandoAcesso || !acessoValido}>{carregandoAcesso ? <LoaderCircle size={15} className="girando" /> : "Salvar senha"}</Botao></div>
          </form>
        )}
      </Modal>

      <ModalInstalacao aberto={modalInstalacaoAberto} aoFechar={() => setModalInstalacaoAberto(false)} />
    </div>
  );
}
