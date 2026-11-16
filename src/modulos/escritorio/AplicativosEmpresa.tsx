import { AppWindow } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { AvisoFaixa } from "../../componentes/basicos";
import { useAuth, type UsuarioAutenticado } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { APLICATIVOS_EMPRESA, itensDoMenuAppsEmpresa } from "./aplicativosEmpresaConfig";
import { SistemaEmpresaAberto } from "./SistemaEmpresaAberto";
import { Aderencias } from "./Aderencias";

export function ConteudoAplicativoEmpresa({ appId, usuario }: { appId: string; usuario: Pick<UsuarioAutenticado, "perfil" | "roboAderencias"> | null }) {
  if (!appId) return <>
    <CabecalhoAba titulo="Apps Empresa" subtitulo="Escolha um aplicativo na sublista de Apps Empresa no menu de navegação." />
    <div className="apps-empresa-vazio"><AppWindow size={20} /><span>Os aplicativos abrem diretamente aqui ao selecioná-los no menu.</span></div>
  </>;

  const item = itensDoMenuAppsEmpresa(usuario).find((app) => app.id === appId);
  if (!item) return <AvisoFaixa tipo="alerta">Este aplicativo não está disponível para sua conta.</AvisoFaixa>;
  if (!item.disponivel) return <AvisoFaixa tipo="alerta">{item.nome} está em manutenção.</AvisoFaixa>;
  if (appId === "aderencias") return <Aderencias />;

  const app = APLICATIVOS_EMPRESA.find((atual) => atual.id === appId);
  return app ? <SistemaEmpresaAberto key={app.id} app={app} /> : null;
}

export default function AplicativosEmpresa() {
  const appId = useInterface((s) => s.parametros.app ?? "");
  const usuario = useAuth((s) => s.usuario);
  return <ConteudoAplicativoEmpresa appId={appId} usuario={usuario} />;
}
