import { ABAS_ILHA, type ConfigIlha } from "../../estado/configuracoes";
import type { UsuarioAutenticado } from "../../estado/autenticacao";
import { abaLigada, type Funcao } from "../../utilitarios/funcoes";

export function abasVisiveisDaIlha(
  usuario: Pick<UsuarioAutenticado, "perfil"> | null,
  configuracao: Pick<ConfigIlha, "ordemAbas" | "blocos">,
  desligadas: readonly Funcao[],
) {
  if (usuario?.perfil !== "dono" && usuario?.perfil !== "gerencia") return [];
  return configuracao.ordemAbas.filter((aba) => ABAS_ILHA.includes(aba) && configuracao.blocos[aba] && abaLigada(aba, desligadas));
}
