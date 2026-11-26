import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Folder, FolderOpen, X, type LucideIcon } from "lucide-react";
import { useInterface } from "../../estado/interface";
import "./appsEmpresaNoMenu.css";

type RotaComSubmenu = "appsEmpresa" | "powerBi" | "planilhasEmpresa";

export interface OpcaoMenuDaEmpresa {
  id: string;
  nome: string;
  icone: LucideIcon;
  desativado?: boolean;
  rotulo?: string;
  estado?: ReactNode;
  secao?: "prototipo" | "gerenciar";
}

interface Props {
  rota: RotaComSubmenu;
  nome: string;
  rotuloLista: string;
  icone: LucideIcon;
  recolhida: boolean;
  escolhido?: string;
  opcoes: OpcaoMenuDaEmpresa[];
  quantidade?: number;
  vazio?: ReactNode;
  aoSelecionar: (id: string) => void;
}

export function MenuDaEmpresa({ rota, nome, rotuloLista, icone: Icone, recolhida, escolhido, opcoes, quantidade, vazio, aoSelecionar }: Props) {
  const nestaArea = useInterface((s) => s.rota === rota);
  const ativo = nestaArea ? opcoes.find((opcao) => opcao.id === escolhido && !opcao.desativado) : undefined;
  const [aberto, setAberto] = useState(nestaArea);
  const [prototiposAbertos, setPrototiposAbertos] = useState(ativo?.secao === "prototipo");
  const [painelAberto, setPainelAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const chave = rota === "appsEmpresa" ? "barra-apps" : `barra-${rota}`;
  const seletorOpcao = 'button.barra-apps-opcao:not(:disabled)';

  useEffect(() => {
    if (nestaArea) setAberto(true);
    setPainelAberto(false);
  }, [nestaArea, recolhida]);

  useEffect(() => {
    if (ativo?.secao === "prototipo") setPrototiposAbertos(true);
  }, [ativo?.id, ativo?.secao]);

  useLayoutEffect(() => {
    if (!painelAberto) return;
    const posicionar = () => {
      const origem = botao.current?.getBoundingClientRect();
      const menu = painel.current;
      if (!origem || !menu) return;
      menu.style.maxHeight = `${Math.max(120, window.innerHeight - 24)}px`;
      menu.style.left = `${Math.max(12, Math.min(origem.right + 12, window.innerWidth - menu.offsetWidth - 12))}px`;
      menu.style.top = `${Math.max(12, Math.min(origem.top, window.innerHeight - menu.offsetHeight - 12))}px`;
      menu.style.visibility = "visible";
    };
    posicionar();
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [painelAberto, quantidade, opcoes.length, prototiposAbertos]);

  useEffect(() => {
    if (!painelAberto) return;
    (painel.current?.querySelector<HTMLButtonElement>(seletorOpcao) ?? painel.current?.querySelector("button"))?.focus();
    const fecharDeFora = (evento: PointerEvent | FocusEvent) => {
      if (evento.target instanceof Node && !painel.current?.contains(evento.target) && !botao.current?.contains(evento.target)) setPainelAberto(false);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setPainelAberto(false);
        botao.current?.focus();
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(evento.key) || !painel.current?.contains(document.activeElement)) return;
      const selecionaveis = [...painel.current.querySelectorAll<HTMLButtonElement>(seletorOpcao)];
      if (!selecionaveis.length) return;
      evento.preventDefault();
      const atual = selecionaveis.indexOf(document.activeElement as HTMLButtonElement);
      const proxima = evento.key === "Home" ? 0 : evento.key === "End" ? selecionaveis.length - 1
        : (atual + (evento.key === "ArrowDown" ? 1 : -1) + selecionaveis.length) % selecionaveis.length;
      selecionaveis[proxima].focus();
    };
    document.addEventListener("pointerdown", fecharDeFora);
    document.addEventListener("focusin", fecharDeFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", fecharDeFora);
      document.removeEventListener("focusin", fecharDeFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [painelAberto, seletorOpcao]);

  const classeItem = (flutuante: boolean) => flutuante ? "barra-apps-opcao" : "barra-item barra-apps-item";
  const renderizarOpcao = (opcao: OpcaoMenuDaEmpresa, flutuante: boolean) => {
    const IconeOpcao = opcao.icone;
    const rotulo = opcao.rotulo ?? opcao.nome;
    return <button key={opcao.id} type="button" className={classeItem(flutuante)}
      data-rota={rota} data-app={rota === "appsEmpresa" ? opcao.id : undefined}
      data-relatorio={rota === "powerBi" ? opcao.id : undefined} data-planilha={rota === "planilhasEmpresa" ? opcao.id : undefined}
      aria-current={ativo?.id === opcao.id ? "page" : undefined} aria-label={rotulo} title={rotulo} disabled={opcao.desativado} onClick={() => {
        setPainelAberto(false);
        if (flutuante) botao.current?.focus();
        aoSelecionar(opcao.id);
      }}>
      <span className="barra-apps-icone"><IconeOpcao size={16} /></span>
      <span className="cortar">{opcao.nome}</span>
      {opcao.estado}
    </button>;
  };

  const entradas = opcoes.filter((opcao) => !opcao.secao);
  const prototipos = opcoes.filter((opcao) => opcao.secao === "prototipo");
  const gerenciar = opcoes.filter((opcao) => opcao.secao === "gerenciar");
  const Pasta = aberto ? FolderOpen : Folder;
  const PastaPrototipos = prototiposAbertos ? FolderOpen : Folder;
  const lista = (flutuante: boolean) => <>
    {entradas.map((opcao) => renderizarOpcao(opcao, flutuante))}
    {entradas.length === 0 && prototipos.length === 0 && vazio}
    {prototipos.length > 0 && <>
      <button type="button" className={`${classeItem(flutuante)} barra-apps-subpasta`}
        aria-expanded={prototiposAbertos} aria-controls={`${chave}-prototipos`}
        aria-current={!flutuante && ativo?.secao === "prototipo" && !prototiposAbertos ? "page" : undefined}
        onClick={() => setPrototiposAbertos((valor) => !valor)}>
        <PastaPrototipos size={16} aria-hidden="true" />
        <span className="cortar">Protótipos</span>
        <ChevronDown size={12} className="barra-apps-seta" aria-hidden="true" />
      </button>
      <div id={`${chave}-prototipos`} className="barra-apps-sublista" role="group" aria-label="Protótipos" hidden={!prototiposAbertos}>
        {prototiposAbertos && prototipos.map((opcao) => renderizarOpcao(opcao, flutuante))}
      </div>
    </>}
    {gerenciar.length > 0 && <div className="barra-apps-gerencia">{gerenciar.map((opcao) => renderizarOpcao(opcao, flutuante))}</div>}
  </>;

  return <div className="barra-apps">
    <button ref={botao} type="button" className="barra-item barra-apps-toggle" data-rota={rota} aria-label={nome}
      title={recolhida && ativo ? `${nome} · ${ativo.nome}` : nome} aria-haspopup={recolhida ? "dialog" : undefined}
      aria-expanded={recolhida ? painelAberto : aberto} aria-controls={`${chave}-${recolhida ? "painel" : "lista"}`}
      aria-current={nestaArea && (recolhida || !aberto || !ativo) ? "page" : undefined} onClick={() => {
        if (recolhida) setPainelAberto((atual) => !atual);
        else setAberto((atual) => !atual);
      }}>
      {recolhida ? <Icone size={17} /> : <Pasta size={17} aria-hidden="true" />}
      <span className="barra-item-texto cortar">{nome}</span>
      {!recolhida && <>{quantidade !== undefined && <span className="barra-apps-quantidade">{quantidade}</span>}<ChevronDown size={12} className="barra-apps-seta" /></>}
    </button>
    {!recolhida && <div id={`${chave}-lista`} className="barra-apps-lista" role="group" aria-label={rotuloLista} hidden={!aberto}>{lista(false)}</div>}
    {recolhida && painelAberto && createPortal(<div ref={painel} id={`${chave}-painel`} className="barra-apps-painel" role="dialog" aria-label={rotuloLista} style={{ visibility: "hidden" }}>
      <div className="barra-apps-painel-cabecalho">
        <div><strong>{nome}</strong><span>{quantidade === undefined ? "Empresa" : `Empresa · ${quantidade} disponíveis`}</span></div>
        <button type="button" className="barra-apps-fechar" aria-label={`Fechar ${nome}`} onClick={() => { setPainelAberto(false); botao.current?.focus(); }}><X size={16} /></button>
      </div>
      <div className="barra-apps-painel-lista">{lista(true)}</div>
    </div>, document.body)}
  </div>;
}
