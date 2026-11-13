import { useEffect, useState } from "react";
import { AppWindow, CalendarDays, ChartNoAxesCombined, ChevronDown, ClipboardCheck, ClipboardList, FileSpreadsheet, LockKeyhole, PackageOpen, Wrench, type LucideIcon } from "lucide-react";
import { useAuth } from "../../estado/autenticacao";
import { useConfig } from "../../estado/configuracoes";
import { useInterface } from "../../estado/interface";
import { itensDoMenuAppsEmpresa } from "../../modulos/escritorio/aplicativosEmpresaConfig";
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
};

export function AppsEmpresaNoMenu({ recolhida, nome = "Apps Empresa" }: { recolhida: boolean; nome?: string }) {
  const rota = useInterface((s) => s.rota);
  const appId = useInterface((s) => s.parametros.app ?? "");
  const irPara = useInterface((s) => s.irPara);
  const usuario = useAuth((s) => s.usuario);
  const [aberto, setAberto] = useState(rota === "appsEmpresa");
  const itens = itensDoMenuAppsEmpresa(usuario);
  const nestaArea = rota === "appsEmpresa";
  const selecionado = itens.some((app) => app.id === appId && app.disponivel);

  useEffect(() => {
    if (rota === "appsEmpresa") setAberto(true);
  }, [rota, appId]);

  return <div className="barra-apps">
    <button type="button" className="barra-item barra-apps-toggle" data-rota="appsEmpresa" aria-label={nome} title={nome} aria-expanded={aberto} aria-controls="barra-apps-lista" aria-current={nestaArea && (!aberto || !selecionado) ? "page" : undefined} onClick={() => {
      setAberto(recolhida ? true : !aberto);
      if (recolhida) {
        const ui = useInterface.getState();
        if (ui.barraAppsRecolhida !== null) ui.definirBarraAppsRecolhida(false);
        else if (useConfig.getState().barraRecolhida) useConfig.getState().definir({ barraRecolhida: false });
      }
    }}>
      <AppWindow size={16} />
      {!recolhida && <><span className="cortar">{nome}</span><ChevronDown size={13} className="barra-apps-seta" /></>}
    </button>
    <div id="barra-apps-lista" className="barra-apps-lista" role="group" aria-label="Aplicativos da empresa" hidden={!aberto}>
      {itens.map((app) => {
        const Icone = ICONES[app.id] ?? AppWindow;
        const ativo = nestaArea && appId === app.id && app.disponivel;
        const rotulo = app.disponivel ? app.nome : `${app.nome}: em manutenção`;
        return <button key={app.id} type="button" className="barra-item barra-subitem barra-apps-item" data-rota="appsEmpresa" data-app={app.id} aria-current={ativo ? "page" : undefined} aria-label={rotulo} title={rotulo} disabled={!app.disponivel} onClick={() => irPara("appsEmpresa", { app: app.id })}>
          <Icone size={15} />
          {!recolhida && <span className="cortar">{app.nome}</span>}
          {!app.disponivel && !recolhida && <Wrench size={12} className="barra-apps-manutencao" />}
        </button>;
      })}
    </div>
  </div>;
}
