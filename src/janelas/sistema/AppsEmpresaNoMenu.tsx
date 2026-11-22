import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppWindow, CalendarDays, ChartNoAxesCombined, ChevronDown, ClipboardCheck, ClipboardList, FileSpreadsheet, LayoutGrid, LockKeyhole, PackageOpen, Settings2, X, type LucideIcon } from "lucide-react";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { GERENCIAR_APLICATIVOS, itensDoMenuAppsEmpresa } from "../../modulos/escritorio/aplicativosEmpresaConfig";
import { useCatalogoAppsEmpresa } from "../../modulos/escritorio/catalogoAppsEmpresa";
import "./appsEmpresaNoMenu.css";

const ICONES: Record<string, LucideIcon> = {
  aderencias: FileSpreadsheet,
  "registros-limpeza": ClipboardCheck,
  "calendario-limpeza": CalendarDays,
  materiais: PackageOpen,
  requisicoes: ClipboardList,
  nps: ChartNoAxesCombined,
  armarios: LockKeyhole,
  solicitacoes: ClipboardList,
  [GERENCIAR_APLICATIVOS]: Settings2,
};

export function AppsEmpresaNoMenu({ recolhida, nome = "Aplicativos" }: { recolhida: boolean; nome?: string }) {
  const rota = useInterface((s) => s.rota);
  const appId = useInterface((s) => s.parametros.app ?? "");
  const irPara = useInterface((s) => s.irPara);
  const usuario = useAuth((s) => s.usuario);
  const [aberto, setAberto] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const { aplicativos } = useCatalogoAppsEmpresa();
  const itens = itensDoMenuAppsEmpresa(usuario, aplicativos);
  const opcoes = usuario?.perfil === "dono"
    ? [...itens, { id: GERENCIAR_APLICATIVOS, nome: "Gerenciar aplicativos", disponivel: true }]
    : itens;
  const nestaArea = rota === "appsEmpresa";
  const selecionado = opcoes.some((app) => app.id === appId && app.disponivel);
  const quantidade = itens.filter((app) => app.disponivel).length;
  const appAtual = opcoes.find((app) => app.id === appId && app.disponivel);

  useEffect(() => {
    if (rota === "appsEmpresa") setAberto(true);
  }, [rota, appId]);

  useEffect(() => setPainelAberto(false), [recolhida, rota, appId]);

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
  }, [painelAberto, quantidade, opcoes.length]);

  useEffect(() => {
    if (!painelAberto) return;
    painel.current?.querySelector<HTMLButtonElement>('button[data-app]:not(:disabled)')?.focus();
    const fecharDeFora = (evento: PointerEvent) => {
      if (evento.target instanceof Node && !painel.current?.contains(evento.target) && !botao.current?.contains(evento.target)) setPainelAberto(false);
    };
    const aoMudarFoco = (evento: FocusEvent) => {
      if (evento.target instanceof Node && !painel.current?.contains(evento.target) && !botao.current?.contains(evento.target)) setPainelAberto(false);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setPainelAberto(false);
        botao.current?.focus();
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(evento.key)) return;
      if (!painel.current?.contains(document.activeElement)) return;
      const opcoes = [...(painel.current?.querySelectorAll<HTMLButtonElement>('button[data-app]:not(:disabled)') ?? [])];
      if (!opcoes.length) return;
      evento.preventDefault();
      const atual = opcoes.indexOf(document.activeElement as HTMLButtonElement);
      const proxima = evento.key === "Home" ? 0 : evento.key === "End" ? opcoes.length - 1 : (atual + (evento.key === "ArrowDown" ? 1 : -1) + opcoes.length) % opcoes.length;
      opcoes[proxima].focus();
    };
    document.addEventListener("pointerdown", fecharDeFora);
    document.addEventListener("focusin", aoMudarFoco);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", fecharDeFora);
      document.removeEventListener("focusin", aoMudarFoco);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [painelAberto]);

  const lista = (flutuante: boolean) => opcoes.map((app) => {
    const Icone = ICONES[app.id] ?? AppWindow;
    const ativo = nestaArea && appId === app.id && app.disponivel;
    const rotulo = app.disponivel ? app.nome : `${app.nome}: em manutenção`;
    return <button key={app.id} type="button" className={flutuante ? "barra-apps-opcao" : "barra-item barra-apps-item"} data-rota="appsEmpresa" data-app={app.id} aria-current={ativo ? "page" : undefined} aria-label={rotulo} title={rotulo} disabled={!app.disponivel} onClick={() => {
      setPainelAberto(false);
      if (flutuante) botao.current?.focus();
      irPara("appsEmpresa", { app: app.id });
    }}>
      <span className="barra-apps-icone"><Icone size={16} /></span>
      <span className="cortar">{app.nome}</span>
      {!app.disponivel && <span className="barra-apps-estado">Manutenção</span>}
    </button>;
  });

  return <div className="barra-apps">
    <button ref={botao} type="button" className="barra-item barra-apps-toggle" data-rota="appsEmpresa" aria-label={nome} title={recolhida && appAtual ? `${nome} · ${appAtual.nome}` : nome} aria-haspopup={recolhida ? "dialog" : undefined} aria-expanded={recolhida ? painelAberto : aberto} aria-controls={recolhida ? "barra-apps-painel" : "barra-apps-lista"} aria-current={nestaArea && (recolhida || !aberto || !selecionado) ? "page" : undefined} onClick={() => {
      if (recolhida) setPainelAberto((atual) => !atual);
      else setAberto((atual) => !atual);
    }}>
      <LayoutGrid size={17} />
      <span className="barra-item-texto cortar">{recolhida ? "Apps" : nome}</span>
      {!recolhida && <><span className="barra-apps-quantidade">{quantidade}</span><ChevronDown size={12} className="barra-apps-seta" /></>}
    </button>
    {!recolhida && <div id="barra-apps-lista" className="barra-apps-lista" role="group" aria-label="Aplicativos da empresa" hidden={!aberto}>{lista(false)}</div>}
    {recolhida && painelAberto && createPortal(<div ref={painel} id="barra-apps-painel" className="barra-apps-painel" role="dialog" aria-label="Aplicativos da empresa" style={{ visibility: "hidden" }}>
      <div className="barra-apps-painel-cabecalho">
        <div><strong>Aplicativos</strong><span>Empresa · {quantidade} disponíveis</span></div>
        <button type="button" className="barra-apps-fechar" aria-label="Fechar aplicativos" onClick={() => { setPainelAberto(false); botao.current?.focus(); }}><X size={16} /></button>
      </div>
      <div className="barra-apps-painel-lista">{lista(true)}</div>
    </div>, document.body)}
  </div>;
}
