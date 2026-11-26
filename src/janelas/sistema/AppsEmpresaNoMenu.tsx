import { AppWindow, CalendarDays, ChartNoAxesCombined, ClipboardCheck, ClipboardList, FileSpreadsheet, LayoutGrid, LockKeyhole, PackageOpen, Settings2, type LucideIcon } from "lucide-react";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { GERENCIAR_APLICATIVOS, itensDoMenuAppsEmpresa, type ItemMenuAplicativoEmpresa } from "../../modulos/escritorio/aplicativosEmpresaConfig";
import { useCatalogoAppsEmpresa } from "../../modulos/escritorio/catalogoAppsEmpresa";
import { MenuDaEmpresa } from "./MenuDaEmpresa";

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

export function AppsEmpresaNoMenu({ recolhida, nome = "Sistemas", aoNavegar }: { recolhida: boolean; nome?: string; aoNavegar?: () => void }) {
  const appId = useInterface((s) => s.parametros.app);
  const irPara = useInterface((s) => s.irPara);
  const usuario = useAuth((s) => s.usuario);
  const { aplicativos } = useCatalogoAppsEmpresa();
  const itens = itensDoMenuAppsEmpresa(usuario, aplicativos);
  const opcoes: ItemMenuAplicativoEmpresa[] = usuario?.perfil === "dono"
    ? [...itens, { id: GERENCIAR_APLICATIVOS, nome: "Gerenciar aplicativos", disponivel: true }]
    : itens;
  return <MenuDaEmpresa rota="appsEmpresa" nome={nome} rotuloLista="Sistemas da empresa" icone={LayoutGrid} recolhida={recolhida}
    escolhido={appId} quantidade={itens.filter((app) => app.disponivel && app.status !== "prototipo" && app.status !== "manutencao").length}
    opcoes={opcoes.map((app) => {
      const prototipo = app.status === "prototipo";
      const manutencao = app.status === "manutencao" || !app.disponivel;
      return {
        id: app.id, nome: app.nome, icone: ICONES[app.id] ?? AppWindow, desativado: !app.disponivel,
        secao: prototipo ? "prototipo" : app.id === GERENCIAR_APLICATIVOS ? "gerenciar" : undefined,
        rotulo: prototipo ? `${app.nome}: protótipo` : manutencao ? `${app.nome}: em manutenção` : app.nome,
        estado: manutencao && !prototipo ? <span className="barra-apps-estado">Manutenção</span> : undefined,
      };
    })}
    aoSelecionar={(id) => { irPara("appsEmpresa", { app: id }); aoNavegar?.(); }}
  />;
}
