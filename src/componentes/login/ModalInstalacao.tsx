import { useState, useEffect } from "react";
import { X, Download, Monitor, Terminal, ShieldCheck, Check, HardDrive, Package, ExternalLink } from "lucide-react";
import manifesto from "../../../package.json";

interface OpcaoDownload {
  id: string;
  os: "windows" | "linux";
  nome: string;
  arquivo: string;
  extensao: string;
  tamanho: string;
  descricao: string;
  destaque?: string;
  url: string;
}

const REPOSITORIO_KYRO = "https://github.com/Pablofellype/kyro";
const VERSAO = manifesto.version;

const OPCOES_INSTALACAO: OpcaoDownload[] = [
  {
    id: "win-exe",
    os: "windows",
    nome: "Instalador Setup Kyro (.exe)",
    arquivo: `Kyro_${VERSAO}_x64-setup.exe`,
    extensao: ".exe",
    tamanho: "30.6 MB",
    descricao: "Instalação automática recomendada do Kyro para Windows 10 e Windows 11 (64-bit). Configuração completa e atalhos.",
    destaque: "Recomendado",
    url: `${REPOSITORIO_KYRO}/releases/latest/download/Kyro_${VERSAO}_x64-setup.exe`,
  },
  {
    id: "win-msi",
    os: "windows",
    nome: "Pacote Kyro Windows Installer (.msi)",
    arquivo: `Kyro_${VERSAO}_x64_pt-BR.msi`,
    extensao: ".msi",
    tamanho: "42.3 MB",
    descricao: "Instalador MSI nativo do Kyro em Português (Brasil). Instalação limpa para ambientes corporativos.",
    url: `${REPOSITORIO_KYRO}/releases/latest/download/Kyro_${VERSAO}_x64_pt-BR.msi`,
  },
  {
    id: "linux-appimage",
    os: "linux",
    nome: "Kyro Linux AppImage Universal",
    arquivo: `Kyro_${VERSAO}_amd64.AppImage`,
    extensao: ".AppImage",
    tamanho: "123 MB",
    descricao: "Executável autônomo do Kyro para qualquer distribuição Linux x86_64. Não requer instalação (chmod +x).",
    destaque: "Portátil",
    url: `${REPOSITORIO_KYRO}/releases/latest/download/Kyro_${VERSAO}_amd64.AppImage`,
  },
  {
    id: "linux-deb",
    os: "linux",
    nome: "Pacote Kyro Debian / Ubuntu (.deb)",
    arquivo: `Kyro_${VERSAO}_amd64.deb`,
    extensao: ".deb",
    tamanho: "53.3 MB",
    descricao: "Pacote oficial para Ubuntu, Debian, Linux Mint e Pop!_OS via gerenciador apt.",
    url: `${REPOSITORIO_KYRO}/releases/latest/download/Kyro_${VERSAO}_amd64.deb`,
  },
  {
    id: "linux-rpm",
    os: "linux",
    nome: "Pacote Kyro Red Hat / Fedora (.rpm)",
    arquivo: `Kyro-${VERSAO}-1.x86_64.rpm`,
    extensao: ".rpm",
    tamanho: "53.3 MB",
    descricao: "Pacote RPM do Kyro para Fedora, RHEL, CentOS Stream, Rocky Linux e openSUSE.",
    url: `${REPOSITORIO_KYRO}/releases/latest/download/Kyro-${VERSAO}-1.x86_64.rpm`,
  },
];

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

export function ModalInstalacao({ aberto, aoFechar }: Props) {
  const [abaAtiva, setAbaAtiva] = useState<"todos" | "windows" | "linux">("todos");
  const [baixadoId, setBaixadoId] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  const itensFiltrados = OPCOES_INSTALACAO.filter((item) =>
    abaAtiva === "todos" ? true : item.os === abaAtiva
  );

  const iniciarDownload = (opcao: OpcaoDownload) => {
    setBaixadoId(opcao.id);
    const link = document.createElement("a");
    link.href = opcao.url;
    link.download = opcao.arquivo;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setBaixadoId(null);
    }, 4000);
  };

  return (
    <div className="kyro-instalador-backdrop" onClick={aoFechar} role="dialog" aria-modal="true">
      <div className="kyro-instalador-janela" onClick={(e) => e.stopPropagation()}>
        {/* Barra superior estilo janela macOS */}
        <header className="kyro-login-barra">
          <div className="kyro-login-bolinhas" aria-hidden="true">
            <span className="kyro-login-bolinha fechar" onClick={aoFechar} style={{ cursor: "pointer" }} />
            <span className="kyro-login-bolinha minimizar" />
            <span className="kyro-login-bolinha maximizar" />
          </div>

          <div className="migalha">
            <span className="migalha-app">KYRO</span>
            <span className="migalha-ponto" aria-hidden="true" />
            <span className="migalha-atual">INSTALADOR OFICIAL</span>
          </div>

          <button
            type="button"
            className="kyro-instalador-fechar-btn"
            onClick={aoFechar}
            aria-label="Fechar janela"
          >
            <X size={15} />
          </button>
        </header>

        {/* Cabeçalho do instalador */}
        <div className="kyro-instalador-cabecalho">
          <div className="kyro-instalador-titulo-linha">
            <div className="kyro-instalador-icone-destaque">
              <Package size={22} />
            </div>
            <div>
              <h2 className="kyro-instalador-titulo">Instalar Kyro Desktop</h2>
              <p className="kyro-instalador-subtitulo">
                Binários oficiais do Kyro (v{VERSAO} · 64-bit) para Windows e Linux.
              </p>
            </div>
          </div>

          {/* Abas de filtro OS */}
          <div className="kyro-instalador-abas">
            <button
              type="button"
              className={`kyro-instalador-aba ${abaAtiva === "todos" ? "ativa" : ""}`}
              onClick={() => setAbaAtiva("todos")}
            >
              <HardDrive size={13} />
              <span>Todos os Pacotes ({OPCOES_INSTALACAO.length})</span>
            </button>
            <button
              type="button"
              className={`kyro-instalador-aba ${abaAtiva === "windows" ? "ativa" : ""}`}
              onClick={() => setAbaAtiva("windows")}
            >
              <Monitor size={13} />
              <span>Windows (2)</span>
            </button>
            <button
              type="button"
              className={`kyro-instalador-aba ${abaAtiva === "linux" ? "ativa" : ""}`}
              onClick={() => setAbaAtiva("linux")}
            >
              <Terminal size={13} />
              <span>Linux (3)</span>
            </button>
          </div>
        </div>

        {/* Lista de pacotes para download */}
        <div className="kyro-instalador-lista">
          {itensFiltrados.map((item) => {
            const baixandoEste = baixadoId === item.id;
            const ehWindows = item.os === "windows";

            return (
              <div key={item.id} className="kyro-instalador-card">
                <div className="kyro-instalador-card-icone" data-os={item.os}>
                  {ehWindows ? <Monitor size={20} /> : <Terminal size={20} />}
                </div>

                <div className="kyro-instalador-card-info">
                  <div className="kyro-instalador-card-titulo-linha">
                    <span className="kyro-instalador-card-nome">{item.nome}</span>
                    <span className="kyro-instalador-badge-ext">{item.extensao}</span>
                    {item.destaque && (
                      <span className="kyro-instalador-badge-destaque">{item.destaque}</span>
                    )}
                  </div>

                  <p className="kyro-instalador-card-desc">{item.descricao}</p>

                  <div className="kyro-instalador-card-meta">
                    <span className="kyro-instalador-card-arquivo">{item.arquivo}</span>
                    <span className="kyro-instalador-card-ponto" aria-hidden="true" />
                    <span className="kyro-instalador-card-tamanho">{item.tamanho}</span>
                  </div>
                </div>

                <div className="kyro-instalador-card-acao">
                  <button
                    type="button"
                    className={`kyro-instalador-btn-baixar ${baixandoEste ? "baixado" : ""}`}
                    onClick={() => iniciarDownload(item)}
                    title={`Baixar ${item.arquivo}`}
                  >
                    {baixandoEste ? (
                      <>
                        <Check size={14} />
                        <span>Baixando...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>Baixar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Informação sobre regras e segurança */}
        <div className="kyro-instalador-aviso">
          <ShieldCheck size={16} className="kyro-instalador-aviso-icone" />
          <div className="kyro-instalador-aviso-texto">
            <strong>Regra de Acesso Kyro:</strong> Após a instalação, execute o aplicativo e faça login com seu e-mail autorizado. As ferramentas nativas (ilha dinâmica, dock e barra inteligente) serão ativadas exclusivamente para usuários com sessão ativa no Neon Postgres.
          </div>
        </div>

        {/* Rodapé da janela */}
        <footer className="kyro-instalador-rodape">
          <div className="kyro-instalador-rodape-seguranca">
            <span className="kyro-login-status-ponto" aria-hidden="true" />
            <span>KYRO {VERSAO} ESTÁVEL · REPOSITÓRIO OFICIAL PABLO FELLYPE</span>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <a
              href={`${REPOSITORIO_KYRO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="kyro-instalador-btn-fechar-texto"
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
            >
              <ExternalLink size={12} />
              <span>Releases no GitHub</span>
            </a>
            <button type="button" className="kyro-instalador-btn-fechar-texto" onClick={aoFechar}>
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
