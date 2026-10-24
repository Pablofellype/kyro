import { useState, type FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, LoaderCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../../estado/autenticacao";
import "./login.css";

interface Props {
  aoSucesso?: () => void;
}

export function TelaLogin({ aoSucesso }: Props) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const definirUsuario = useAuth((s) => s.definirUsuario);

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
      const res = await fetch("/api/auth?acao=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLimpo, senha }),
      });

      const dados = await res.json();
      if (!res.ok || !dados.sucesso) {
        setErro(dados.erro || "Falha ao realizar login.");
        setCarregando(false);
        return;
      }

      definirUsuario(dados.usuario, dados.token);
      aoSucesso?.();
    } catch {
      setErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="kyro-login-container">
      <div className="kyro-login-card">
        <header className="kyro-login-cabecalho">
          <div className="kyro-login-logo-icone" aria-hidden="true">
            <ShieldCheck size={26} />
          </div>
          <h1 className="kyro-login-titulo">KYRO</h1>
          <p className="kyro-login-sub">Sistema Pessoal de Produtividade & IA</p>
        </header>

        <form className="kyro-login-form" onSubmit={submeter}>
          {erro && (
            <div className="kyro-login-erro" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{erro}</span>
            </div>
          )}

          <div className="kyro-login-campo">
            <label className="kyro-login-rotulo" htmlFor="campo-email">
              E-mail Autorizado
            </label>
            <div className="kyro-login-input-wrapper">
              <span className="kyro-login-input-icone" aria-hidden="true">
                <Mail size={16} />
              </span>
              <input
                id="campo-email"
                type="email"
                className="kyro-login-input"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                disabled={carregando}
                required
              />
            </div>
          </div>

          <div className="kyro-login-campo">
            <label className="kyro-login-rotulo" htmlFor="campo-senha">
              Senha de Acesso
            </label>
            <div className="kyro-login-input-wrapper">
              <span className="kyro-login-input-icone" aria-hidden="true">
                <Lock size={16} />
              </span>
              <input
                id="campo-senha"
                type={mostrarSenha ? "text" : "password"}
                className="kyro-login-input"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                disabled={carregando}
                required
              />
              <button
                type="button"
                className="kyro-login-olho"
                onClick={() => setMostrarSenha((v) => !v)}
                tabIndex={-1}
                aria-label={mostrarSenha ? "Ocultar senha" : "Ver senha"}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="kyro-login-botao" disabled={carregando}>
            {carregando ? (
              <>
                <LoaderCircle size={16} className="girando" />
                <span>Autenticando...</span>
              </>
            ) : (
              <span>Entrar no Sistema</span>
            )}
          </button>
        </form>

        <footer className="kyro-login-rodape">
          <ShieldCheck size={12} />
          <span>Acesso protegido e restrito</span>
        </footer>
      </div>
    </div>
  );
}
