import { AppWindow } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { AvisoFaixa } from "../../componentes/basicos";
import { useAuth, type UsuarioAutenticado } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { APLICATIVOS_EMPRESA, GERENCIAR_APLICATIVOS, itensDoMenuAppsEmpresa, type AplicativoEmpresa } from "./aplicativosEmpresaConfig";
import { useCatalogoAppsEmpresa } from "./catalogoAppsEmpresa";
import { GerenciarAplicativosEmpresa } from "./GerenciarAplicativosEmpresa";
import { SistemaEmpresaAberto } from "./SistemaEmpresaAberto";
import { Aderencias } from "./Aderencias";

export function ConteudoAplicativoEmpresa({ appId, usuario, aplicativos = APLICATIVOS_EMPRESA, mobile = false }: {
  appId: string;
  usuario: Pick<UsuarioAutenticado, "perfil" | "roboAderencias"> | null;
  aplicativos?: AplicativoEmpresa[];
  mobile?: boolean;
}) {
  if (appId === GERENCIAR_APLICATIVOS || (!appId && usuario?.perfil === "dono")) {
    return usuario?.perfil === "dono" ? <GerenciarAplicativosEmpresa /> : <AvisoFaixa tipo="alerta">Este aplicativo não está disponível para sua conta.</AvisoFaixa>;
  }
  if (!appId) return <>
    <CabecalhoAba titulo="Apps Empresa" subtitulo="Escolha um aplicativo na sublista de Apps Empresa no menu de navegação." />
    <div className="apps-empresa-vazio"><AppWindow size={20} /><span>Os aplicativos abrem diretamente aqui ao selecioná-los no menu.</span></div>
  </>;

  const item = itensDoMenuAppsEmpresa(usuario, aplicativos).find((app) => app.id === appId);
  if (!item) return <AvisoFaixa tipo="alerta">Este aplicativo não está disponível para sua conta.</AvisoFaixa>;
  if (!item.disponivel) return <AvisoFaixa tipo="alerta">{item.nome} está em manutenção.</AvisoFaixa>;
  if (appId === "aderencias") return <Aderencias />;

  const app = aplicativos.find((atual) => atual.id === appId);
  return app ? <SistemaEmpresaAberto key={`${app.id}:${app.url}`} app={app} mobile={mobile} /> : null;
}

export default function AplicativosEmpresa({ mobile = false }: { mobile?: boolean }) {
  const appId = useInterface((s) => s.parametros.app ?? "");
  const usuario = useAuth((s) => s.usuario);
  const { aplicativos } = useCatalogoAppsEmpresa();
  return <ConteudoAplicativoEmpresa appId={appId} usuario={usuario} aplicativos={aplicativos} mobile={mobile} />;
}
