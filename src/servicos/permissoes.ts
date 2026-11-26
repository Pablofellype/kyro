import type { AreaSistema, Rota } from "../tipos";
import type { UsuarioAutenticado } from "../estado/autenticacao";

export type PapelOrganizacional = UsuarioAutenticado["perfil"];

export const ROTAS_DA_EMPRESA: Rota[] = ["escritorio", "appsEmpresa", "powerBi", "planilhasEmpresa", "sults", "calendario", "conexoes", "whatsapp", "configuracoes", "atualizacao"];

const CONFIGURACOES_PESSOAIS = new Set([
  "geral", "aparencia", "ilha", "dock", "assistive", "pomodoro", "sons", "tela", "atalhos", "privacidade", "sobre",
]);

export function podeAcessarConfiguracao(usuario: Pick<UsuarioAutenticado, "perfil"> | null | undefined, secao: string): boolean {
  return usuario?.perfil === "dono" || (usuario?.perfil === "gerencia" && CONFIGURACOES_PESSOAIS.has(secao));
}

export function ehDono(usuario: Pick<UsuarioAutenticado, "perfil"> | null | undefined): boolean {
  return usuario?.perfil === "dono";
}

export function podeAcessarArea(usuario: Pick<UsuarioAutenticado, "perfil"> | null | undefined, area: AreaSistema): boolean {
  return !usuario || usuario.perfil === "dono" || area === "empresa";
}

export function podeAcessarRota(
  usuario: (Pick<UsuarioAutenticado, "perfil"> & Partial<Pick<UsuarioAutenticado, "roboAderencias">>) | null | undefined,
  rota: Rota,
  area: AreaSistema,
): boolean {
  if (rota === "importados") return usuario?.perfil === "dono" && area === "pessoal";
  if (rota === "planilhasEmpresa") return area === "empresa" && (usuario?.perfil === "dono" || (usuario?.perfil === "gerencia" && usuario.roboAderencias === true));
  if (!usuario || usuario.perfil === "dono") return true;
  if (area !== "empresa") return false;
  if (usuario.perfil === "gerencia") return ROTAS_DA_EMPRESA.includes(rota);
  return false;
}

export function rotuloDoPapel(perfil: PapelOrganizacional): string {
  if (perfil === "dono") return "Dono";
  if (perfil === "gerencia") return "Gerência";
  return "Visitante";
}
