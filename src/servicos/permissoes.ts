import type { AreaSistema, Rota } from "../tipos";
import type { UsuarioAutenticado } from "../estado/autenticacao";

export type PapelOrganizacional = UsuarioAutenticado["perfil"];

export const ROTAS_DA_EMPRESA: Rota[] = ["escritorio", "appsEmpresa", "calendario", "conexoes", "whatsapp"];

export function ehDono(usuario: Pick<UsuarioAutenticado, "perfil"> | null | undefined): boolean {
  return usuario?.perfil === "dono";
}

export function podeAcessarArea(usuario: Pick<UsuarioAutenticado, "perfil"> | null | undefined, area: AreaSistema): boolean {
  return !usuario || usuario.perfil === "dono" || area === "empresa";
}

export function podeAcessarRota(
  usuario: Pick<UsuarioAutenticado, "perfil"> | null | undefined,
  rota: Rota,
  area: AreaSistema,
): boolean {
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
