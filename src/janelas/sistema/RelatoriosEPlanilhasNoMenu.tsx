import { ChartNoAxesCombined, FileSpreadsheet, Settings2 } from "lucide-react";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { carregarPlanilhasEmpresa, usarPlanilhasEmpresa } from "../../modulos/escritorio/catalogoPlanilhasEmpresa";
import { usarCatalogoPowerBi } from "../../modulos/escritorio/catalogoPowerBi";
import { MenuDaEmpresa, type OpcaoMenuDaEmpresa } from "./MenuDaEmpresa";

type Props = { recolhida: boolean; nome?: string; aoNavegar?: () => void };
const GERENCIAR = "gerenciar-relatorios";
const GERENCIAR_PLANILHAS = "gerenciar:planilhas";

function situacaoDaLista(carregada: boolean, erro: boolean, vazio: string, atualizar: () => void) {
  if (erro) return <button type="button" className="botao botao-fantasma botao-pequeno" onClick={() => atualizar()}>Tentar novamente</button>;
  return <span className="barra-apps-vazio" role="status">{carregada ? vazio : "Carregando…"}</span>;
}

export function PowerBiNoMenu({ recolhida, nome = "Power BI", aoNavegar }: Props) {
  const token = useAuth((s) => s.token);
  const dono = useAuth((s) => s.usuario?.perfil === "dono");
  const { relatorios, erro, atualizar } = usarCatalogoPowerBi(token);
  const parametros = useInterface((s) => s.parametros);
  const irPara = useInterface((s) => s.irPara);
  const opcoes: OpcaoMenuDaEmpresa[] = (relatorios ?? []).map(({ id, nome }) => ({ id, nome, icone: ChartNoAxesCombined }));
  if (dono) opcoes.push({ id: GERENCIAR, nome: "Gerenciar relatórios", icone: Settings2, secao: "gerenciar" });
  const escolhido = dono && parametros.modo === "gerenciar" ? GERENCIAR : relatorios?.find((item) => item.id === parametros.relatorio)?.id ?? relatorios?.[0]?.id;
  return <MenuDaEmpresa rota="powerBi" nome={nome} rotuloLista="Relatórios do Power BI" icone={ChartNoAxesCombined} recolhida={recolhida}
    opcoes={opcoes} escolhido={escolhido} quantidade={relatorios?.length} vazio={situacaoDaLista(!!relatorios, erro, "Nenhum relatório liberado.", atualizar)}
    aoSelecionar={(id) => {
      irPara("powerBi", id === GERENCIAR ? { modo: "gerenciar" } : { relatorio: id });
      aoNavegar?.();
    }}
  />;
}

export function PlanilhasNoMenu({ recolhida, nome = "Planilhas", aoNavegar }: Props) {
  const { itens, erro } = usarPlanilhasEmpresa();
  const dono = useAuth((s) => s.usuario?.perfil === "dono");
  const parametros = useInterface((s) => s.parametros);
  const irPara = useInterface((s) => s.irPara);
  const opcoes: OpcaoMenuDaEmpresa[] = (itens ?? []).map(({ id, nome }) => ({ id, nome, icone: FileSpreadsheet }));
  if (dono) opcoes.push({ id: GERENCIAR_PLANILHAS, nome: "Gerenciar planilhas", icone: Settings2, secao: "gerenciar" });
  const escolhido = dono && parametros.modo === "gerenciar" ? GERENCIAR_PLANILHAS
    : itens?.find((item) => item.id === parametros.planilha)?.id ?? itens?.[0]?.id;
  return <MenuDaEmpresa rota="planilhasEmpresa" nome={nome} rotuloLista="Planilhas da empresa" icone={FileSpreadsheet} recolhida={recolhida}
    opcoes={opcoes} escolhido={escolhido} quantidade={itens?.length}
    vazio={situacaoDaLista(!!itens, erro, "Nenhuma planilha disponível.", carregarPlanilhasEmpresa)}
    aoSelecionar={(id) => {
      irPara("planilhasEmpresa", id === GERENCIAR_PLANILHAS ? { modo: "gerenciar" } : { planilha: id });
      aoNavegar?.();
    }}
  />;
}
