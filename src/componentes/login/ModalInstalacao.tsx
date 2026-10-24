import { useState, useEffect } from "react";
import { X, Download, Monitor, Terminal, ShieldCheck, Check, HardDrive, Package } from "lucide-react";

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

const OPCOES_INSTALACAO: OpcaoDownload[] = [
  {
    id: "win-exe",
    os: "windows",
    nome: "Instalador Setup Windows",
    arquivo: "Niko_0.2.7_x64-setup.exe",
    extensao: ".exe",
    tamanho: "30.6 MB",
    descricao: "Instalação automática recomendada para Windows 10 e Windows 11 (64-bit). Cria atalhos e configura inicialização.",
    destaque: "Recomendado",
    url: "https://github.com/vitorcgo/Niko/releases/download/v0.2.7/Niko_0.2.7_x64-setup.exe",
  },
  {
    id: "win-msi",
    os: "windows",
    nome: "Pacote Windows Installer",
    arquivo: "Niko_0.2.7_x64_pt-BR.msi",
    extensao: ".msi",
    tamanho: "42.3 MB",
    descricao: "Instalador MSI nativo do Windows em Português (Brasil). Ideal para instalações limpas e gerenciadas.",
    url: "https://github.com/vitorcgo/Niko/releases/download/v0.2.7/Niko_0.2.7_x64_pt-BR.msi",
  },
  {
    id: "linux-appimage",
    os: "linux",
    nome: "Pacote Linux AppImage",
    arquivo: "Niko_0.2.7_amd64.AppImage",
    extensao: ".AppImage",
    tamanho: "123 MB",
    descricao: "Executável universal e portátil para qualquer distribuição Linux x86_64. Não requer instalação (chmod +x).",
    destaque: "Portátil",
    url: "https://github.com/vitorcgo/Niko/releases/download/v0.2.7/Niko_0.2.7_amd64.AppImage",
  },
  {
    id: "linux-deb",
    os: "linux",
    nome: "Pacote Debian / Ubuntu",
    arquivo: "Niko_0.2.7_amd64.deb",
    extensao: ".deb",
    tamanho: "53.3 MB",
    descricao: "Pacote de instalação para Ubuntu, Debian, Linux Mint, Pop!_OS e derivadas com gerenciador apt.",
    url: "https://github.com/vitorcgo/Niko/releases/download/v0.2.7/Niko_0.2.7_amd64.deb",
  },
  {
    id: "linux-rpm",
    os: "linux",
    nome: "Pacote Red Hat / Fedora",
    arquivo: "Niko-0.2.7-1.x86_64.rpm",
    extensao: ".rpm",
    tamanho: "53.3 MB",
    descricao: "Pacote RPM para Fedora, RHEL, CentOS Stream, Rocky Linux e openSUSE (dnf / rpm / zypper).",
    url: "https://github.com/vitorcgo/Niko/releases/download/v0.2.7/Niko-0.2.7-1.x86_64.rpm",
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
    // Cria elemento âncora temporário para disparar o download
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
            <span className="migalha-atual">DOWNLOAD & INSTALAÇÃO</span>
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
                Escolha o pacote oficial compatível com seu sistema operacional (Versão 0.2.7 · 64-bit).
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
            <strong>Regra de Acesso:</strong> Após a instalação, execute o aplicativo e faça login com seu e-mail autorizado. As ferramentas nativas (ilha dinâmica, dock e barra inteligente) serão ativadas exclusivamente para usuários com sessão ativa.
          </div>
        </div>

        {/* Rodapé da janela */}
        <footer className="kyro-instalador-rodape">
          <div className="kyro-instalador-rodape-seguranca">
            <span className="kyro-login-status-ponto" aria-hidden="true" />
            <span>VERSÃO 0.2.7 ESTÁVEL · REPOSITÓRIO OFICIAL</span>
          </div>

          <button type="button" className="kyro-instalador-btn-fechar-texto" onClick={aoFechar}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
