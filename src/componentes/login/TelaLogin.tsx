import { useState, type FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff, LoaderCircle, AlertCircle, ArrowRight, ShieldCheck, Download } from "lucide-react";
import { useAuth, urlApi } from "../../estado/autenticacao";
import { LogoNiko } from "../LogoNiko";
import { ModalInstalacao } from "./ModalInstalacao";
import manifesto from "../../../package.json";
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
  const [modalInstalacaoAberto, setModalInstalacaoAberto] = useState(false);

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
      const res = await fetch(urlApi("/api/auth?acao=login"), {
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
    <div className="estilo-sistema kyro-login-fundo">
      <div className="kyro-login-janela">
        {/* Barra superior estilo janela macOS/Kyro */}
        <header className="kyro-login-barra">
          <div className="kyro-login-bolinhas" aria-hidden="true">
            <span className="kyro-login-bolinha fechar" />
            <span className="kyro-login-bolinha minimizar" />
            <span className="kyro-login-bolinha maximizar" />
          </div>

          <div className="migalha">
            <span className="migalha-app">KYRO</span>
            <span className="migalha-ponto" aria-hidden="true" />
            <span className="migalha-atual">ACESSO AO SISTEMA</span>
          </div>

          <div className="kyro-login-status-badge">
            <span className="kyro-login-status-ponto" aria-hidden="true" />
            <span>ONLINE</span>
          </div>
        </header>

        {/* Corpo principal */}
        <div className="kyro-login-corpo">
          <div className="kyro-login-cabecalho">
            <LogoNiko tamanho={58} brilho />
            <h1 className="kyro-login-titulo">Acesso Autorizado</h1>
            <p className="kyro-login-subtitulo">
              Ambiente restrito protegido por credenciais criptografadas.
            </p>
          </div>

          <div className="kyro-login-divisor" aria-hidden="true" />

          <form className="kyro-login-form" onSubmit={submeter}>
            {erro && (
              <div className="kyro-login-alerta-erro" role="alert">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{erro}</span>
              </div>
            )}

            <div className="kyro-login-campo-grupo">
              <label className="kyro-login-rotulo" htmlFor="login-email">
                <span>E-MAIL AUTORIZADO</span>
              </label>
              <div className="kyro-login-input-caixa">
                <span className="kyro-login-icone-campo" aria-hidden="true">
                  <Mail size={15} />
                </span>
                <input
                  id="login-email"
                  type="email"
                  className="kyro-login-input"
                  placeholder="pablofellype03@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={carregando}
                  required
                />
              </div>
            </div>

            <div className="kyro-login-campo-grupo">
              <label className="kyro-login-rotulo" htmlFor="login-senha">
                <span>SENHA DE ACESSO</span>
              </label>
              <div className="kyro-login-input-caixa">
                <span className="kyro-login-icone-campo" aria-hidden="true">
                  <Lock size={15} />
                </span>
                <input
                  id="login-senha"
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
                  {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" className="kyro-login-botao-entrar" disabled={carregando}>
              {carregando ? (
                <>
                  <LoaderCircle size={15} className="girando" />
                  <span>Verificando Acesso...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="kyro-login-divisor" aria-hidden="true" />

          {/* Botão de Instalação Desktop */}
          <button
            type="button"
            className="kyro-login-botao-instalar"
            onClick={() => setModalInstalacaoAberto(true)}
            title="Baixar instalador para Windows ou Linux"
          >
            <span className="kyro-login-botao-instalar-esquerda">
              <Download size={14} className="kyro-login-icone-download" />
              <span>Instalar Kyro no seu Computador</span>
            </span>
            <span className="kyro-login-badge-versao">v{manifesto.version}</span>
          </button>

          <footer className="kyro-login-rodape-info">
            <ShieldCheck size={13} style={{ color: "var(--sucesso, #3dd68c)" }} />
            <span>NEON POSTGRES · SÃO PAULO (BR)</span>
          </footer>
        </div>
      </div>

      <ModalInstalacao
        aberto={modalInstalacaoAberto}
        aoFechar={() => setModalInstalacaoAberto(false)}
      />
    </div>
  );
}
