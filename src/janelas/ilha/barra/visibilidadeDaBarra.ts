import type { EstadoDaFrente } from "../../../desktop/desktop";
import type { EstadoIlha } from "../../../estado/ilha";

export function areaDeTrabalhoNaFrente(frente: EstadoDaFrente, anterior: boolean): boolean {
  if (frente.telaCheia) return false;
  if (frente.frente === "sobreposta") return anterior;
  return frente.frente === "area_de_trabalho";
}

export function focoDaAreaPeloElemento(alvo: Element | null): boolean | undefined {
  if (alvo?.closest(".janela")) return false;
  if (alvo?.matches(".area-trabalho")) return true;
  return undefined;
}

export function mostrarLateraisDaIlha({ ativadas, estado, saudando, telaCheia, areaEmFoco, sistemaEmFoco = false, emUso = false }: {
  ativadas: boolean;
  estado: EstadoIlha;
  saudando: boolean;
  telaCheia: boolean;
  areaEmFoco: boolean;
  sistemaEmFoco?: boolean;
  emUso?: boolean;
}): boolean {
  return ativadas && !telaCheia && !saudando && (emUso || (estado !== "escondida" && (areaEmFoco || sistemaEmFoco || estado === "expandida")));
}

// Espaço dos controles, incluindo a distância até a ilha em cada lado.
export function reservaDasLaterais(larguraDaTela: number): number {
  return larguraDaTela <= 1100 ? 240 : 400;
}
