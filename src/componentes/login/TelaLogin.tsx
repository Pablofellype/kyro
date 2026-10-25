import { useState, type FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff, LoaderCircle, AlertCircle, ArrowRight, ShieldCheck, Download, Activity, Check, Sparkles } from "lucide-react";
import { cabecalhosNiko, useAuth, urlApi } from "../../estado/autenticacao";
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
        headers: { ...cabecalhosNiko(), "Content-Type": "application/json" },
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
      <div className="kyro-login-glow kyro-login-glow-a" aria-hidden="true" />
      <div className="kyro-login-glow kyro-login-glow-b" aria-hidden="true" />

      <div className="kyro-login-novo">
        <header className="kyro-login-novo-topo">
          <div className="kyro-login-novo-marca">
            <span className="kyro-login-novo-logo"><LogoNiko tamanho={30} brilho /></span>
            <span><strong>KYRO</strong><small>PERSONAL SYSTEM</small></span>
          </div>
          <div className="kyro-login-novo-topo-meta">
            <span>ACCESS GATEWAY</span>
            <span className="kyro-login-novo-online"><i aria-hidden="true" /> SECURE / ONLINE</span>
          </div>
        </header>

        <div className="kyro-login-novo-grade">
          <section className="kyro-login-novo-manifesto">
            <div className="kyro-login-novo-manifesto-topo">
              <span>KY / 001</span>
              <span>PRIVATE WORKSPACE</span>
            </div>
            <div className="kyro-login-novo-manifesto-centro">
              <span className="kyro-login-novo-overline">UM SISTEMA PARA O QUE IMPORTA</span>
              <h1>Trabalhe com<br /><em>clareza.</em></h1>
              <p>O Kyro reúne seu ritmo, suas ideias e o próximo passo em um espaço feito para você.</p>
            </div>
            <div className="kyro-login-novo-poster" aria-hidden="true">
              <span className="kyro-login-novo-poster-numero">01</span>
              <span className="kyro-login-novo-poster-linha" />
              <span className="kyro-login-novo-poster-texto">FOCO<br />CONTEXTO<br />MOVIMENTO</span>
            </div>
            <div className="kyro-login-novo-manifesto-rodape">
              <span>DESIGNADO PARA DIAS REAIS</span>
              <span>SAO PAULO / BR</span>
            </div>
          </section>

          <section className="kyro-login-novo-acesso" aria-labelledby="login-novo-titulo">
            <div className="kyro-login-novo-acesso-topo">
              <span>01 / 02</span>
              <span>IDENTIDADE</span>
            </div>
            <div className="kyro-login-novo-acesso-conteudo">
              <span className="kyro-login-novo-overline">BEM-VINDO DE VOLTA</span>
              <h2 id="login-novo-titulo">Entre no<br /><em>seu espaço.</em></h2>
              <p className="kyro-login-novo-descricao">Acesse sua área pessoal para continuar o que realmente importa.</p>

              <form className="kyro-login-novo-formulario" onSubmit={submeter}>
                {erro && (
                  <div className="kyro-login-novo-erro" role="alert">
                    <AlertCircle size={16} />
                    <span>{erro}</span>
                  </div>
                )}

                <label className="kyro-login-novo-campo" htmlFor="login-novo-email">
                  <span>E-MAIL DE ACESSO</span>
                  <div>
                    <Mail size={16} aria-hidden="true" />
                    <input
                      id="login-novo-email"
                      type="email"
                      placeholder="voce@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                      disabled={carregando}
                      required
                    />
                  </div>
                </label>

                <label className="kyro-login-novo-campo" htmlFor="login-novo-senha">
                  <span>SENHA <small>PROTEGIDA</small></span>
                  <div>
                    <Lock size={16} aria-hidden="true" />
                    <input
                      id="login-novo-senha"
                      type={mostrarSenha ? "text" : "password"}
                      placeholder="••••••••"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      autoComplete="current-password"
                      disabled={carregando}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha((v) => !v)}
                      aria-label={mostrarSenha ? "Ocultar senha" : "Ver senha"}
                    >
                      {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <button type="submit" className="kyro-login-novo-entrar" disabled={carregando}>
                  {carregando ? <LoaderCircle size={17} className="girando" /> : <span>Entrar no Kyro</span>}
                  {!carregando && <ArrowRight size={17} />}
                </button>
                <span className="kyro-login-novo-hint"><ShieldCheck size={12} /> Sessão protegida por conexão local</span>
              </form>

              <button type="button" className="kyro-login-novo-instalar" onClick={() => setModalInstalacaoAberto(true)}>
                <Download size={15} />
                <span><strong>Instalar o Kyro</strong><small>Leve seu espaço para o computador</small></span>
                <span>v{manifesto.version}</span>
              </button>
            </div>
            <div className="kyro-login-novo-acesso-rodape"><span>NEON POSTGRES</span><span>SESSÃO LOCAL</span></div>
          </section>

          <aside className="kyro-login-novo-info" aria-label="Informações do Kyro">
            <div className="kyro-login-novo-info-topo"><span>02 / 02</span><span>SEU AMBIENTE</span></div>
            <div className="kyro-login-novo-info-corpo">
              <div className="kyro-login-novo-sinal"><i aria-hidden="true" /><span>SISTEMA PRONTO</span></div>
              <h3>Menos ruído.<br /><em>Mais direção.</em></h3>
              <div className="kyro-login-novo-info-linha"><span>01</span><p>Organização sem excesso</p></div>
              <div className="kyro-login-novo-info-linha"><span>02</span><p>Contexto sempre por perto</p></div>
              <div className="kyro-login-novo-info-linha"><span>03</span><p>Um próximo passo claro</p></div>
            </div>
            <div className="kyro-login-novo-info-rodape"><span>KYRO / WORKSPACE</span><span>v{manifesto.version}</span></div>
          </aside>
        </div>
      </div>

      <main className="kyro-login-shell">
        <section className="kyro-login-apresentacao" aria-label="Sobre o Kyro">
          <div className="kyro-login-apresentacao-topo">
            <div className="kyro-login-brand">
              <span className="kyro-login-brand-mark"><LogoNiko tamanho={40} brilho /></span>
              <span className="kyro-login-brand-texto">
                <strong>KYRO</strong>
                <small>PERSONAL SYSTEM</small>
              </span>
            </div>
            <span className="kyro-login-brand-index">KY / 01</span>
          </div>

          <nav className="kyro-login-navegacao" aria-label="Prévia da navegação do Kyro">
            <span className="kyro-login-navegacao-label">PRINCIPAL</span>
            <span className="kyro-login-navegacao-item ativo"><i aria-hidden="true" />Início</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Chat</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Escritório</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Conexões</span>
            <span className="kyro-login-navegacao-label">ORGANIZAÇÃO</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Journal</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Estudos</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Finanças</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Metas</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Calendário</span>
            <span className="kyro-login-navegacao-label">FERRAMENTAS</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Modelos de IA</span>
            <span className="kyro-login-navegacao-item"><i aria-hidden="true" />Conquistas</span>
          </nav>

          <div className="kyro-login-sidebar-status"><span aria-hidden="true" /> CONEXÃO LOCAL · PRONTA</div>

          <div className="kyro-login-apresentacao-copy">
            <span className="kyro-login-kicker"><i aria-hidden="true" /> SEU ESPAÇO PESSOAL</span>
            <h1>Seu dia,<br /><em>mais claro.</em></h1>
            <p>Um lugar silencioso para organizar o que importa e seguir para o próximo passo.</p>
          </div>

          <div className="kyro-login-pulse">
            <div className="kyro-login-pulse-topo">
              <span><Activity size={13} /> KYRO / SYSTEM PULSE</span>
              <span className="kyro-login-live"><i aria-hidden="true" /> AO VIVO</span>
            </div>
            <div className="kyro-login-pulse-grafico" aria-hidden="true">
              <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
            </div>
            <div className="kyro-login-pulse-rodape">
              <span className="kyro-login-pulse-status"><span aria-hidden="true" /> Seu espaço está pronto</span>
              <strong>100%</strong>
            </div>
          </div>

          <div className="kyro-login-beneficios">
            <span><Check size={13} /> Tarefas e ideias alinhadas</span>
            <span><Check size={13} /> Contexto sempre por perto</span>
          </div>

          <div className="kyro-login-apresentacao-base">
            <span>DESIGNADO PARA FOCO</span>
            <span className="kyro-login-apresentacao-linha" aria-hidden="true" />
            <span>v{manifesto.version}</span>
          </div>
        </section>

        <section className="kyro-login-painel" aria-labelledby="login-titulo">
          <div className="kyro-login-painel-topo">
            <span>ACESSO AO SISTEMA</span>
            <span>01 <i aria-hidden="true">—</i> 02</span>
          </div>

          <div className="kyro-login-painel-conteudo">
            <header className="kyro-login-painel-cabecalho">
              <span className="kyro-login-kicker">01 — AUTENTICAÇÃO</span>
              <h2 id="login-titulo">Acesso<br /><em>ao Kyro.</em></h2>
              <p>Entre para abrir seu espaço de trabalho e continuar de onde parou.</p>
            </header>

            <form className="kyro-login-formulario" onSubmit={submeter}>
              {erro && (
                <div className="kyro-login-erro" role="alert">
                  <AlertCircle size={16} />
                  <span>{erro}</span>
                </div>
              )}

              <div className="kyro-login-campo">
                <label htmlFor="login-email">E-MAIL</label>
                <div className="kyro-login-campo-caixa">
                  <Mail className="kyro-login-campo-icone" size={17} aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="voce@exemplo.com"
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
                <label htmlFor="login-senha">SENHA <span>SESSÃO PROTEGIDA</span></label>
                <div className="kyro-login-campo-caixa">
                  <Lock className="kyro-login-campo-icone" size={17} aria-hidden="true" />
                  <input
                    id="login-senha"
                    type={mostrarSenha ? "text" : "password"}
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="current-password"
                    disabled={carregando}
                    required
                  />
                  <button
                    type="button"
                    className="kyro-login-mostrar-senha"
                    onClick={() => setMostrarSenha((v) => !v)}
                    tabIndex={-1}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Ver senha"}
                  >
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="kyro-login-submit" disabled={carregando}>
                {carregando ? (
                  <>
                    <LoaderCircle size={17} className="girando" />
                    <span>Verificando acesso</span>
                  </>
                ) : (
                  <>
                    <span>Continuar para o Kyro</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
              <span className="kyro-login-submit-hint"><Sparkles size={12} /> Seus dados ficam protegidos nesta sessão</span>
            </form>

            <div className="kyro-login-ou"><span>OU</span></div>

            <button
              type="button"
              className="kyro-login-instalar"
              onClick={() => setModalInstalacaoAberto(true)}
              title="Baixar instalador para Windows ou Linux"
            >
              <span className="kyro-login-instalar-icone"><Download size={16} /></span>
              <span className="kyro-login-instalar-texto">
                <strong>Leve o Kyro com você</strong>
                <small>Instale no seu computador</small>
              </span>
              <span className="kyro-login-instalar-versao">v{manifesto.version}</span>
            </button>
          </div>

          <footer className="kyro-login-painel-rodape">
            <span><ShieldCheck size={14} /> CONEXÃO SEGURA</span>
            <span>NEON POSTGRES · SÃO PAULO, BR</span>
          </footer>
        </section>

        <aside className="kyro-login-contexto" aria-label="Resumo do ambiente Kyro">
          <div className="kyro-login-contexto-topo">
            <span>02 — AMBIENTE</span>
            <span className="kyro-login-contexto-estado"><i aria-hidden="true" /> ONLINE</span>
          </div>

          <div className="kyro-login-contexto-corpo">
            <div className="kyro-login-contexto-intro">
              <span className="kyro-login-contexto-numero">KY / 2026</span>
              <h3>Um espaço<br /><em>para fazer.</em></h3>
              <p>Tarefas, ideias e decisões em um só lugar.</p>
            </div>

            <div className="kyro-login-contexto-card">
              <span className="kyro-login-contexto-card-label">SESSÃO</span>
              <strong>Pronta para começar</strong>
              <span className="kyro-login-contexto-card-barra"><i aria-hidden="true" /></span>
              <small>Dados protegidos por conexão local.</small>
            </div>

            <div className="kyro-login-contexto-lista">
              <span><b>01</b> Organize o seu dia</span>
              <span><b>02</b> Mantenha o contexto</span>
              <span><b>03</b> Faça o próximo passo</span>
            </div>
          </div>

          <div className="kyro-login-contexto-rodape">
            <span>KYRO WORKSPACE</span>
            <span>v{manifesto.version}</span>
          </div>
        </aside>
      </main>

      {false && <div className="kyro-login-janela">
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
      </div>}

      <ModalInstalacao
        aberto={modalInstalacaoAberto}
        aoFechar={() => setModalInstalacaoAberto(false)}
      />
    </div>
  );
}
