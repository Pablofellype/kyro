import { ChevronLeft, ChevronRight } from "lucide-react";

export type LadoDaIlha = "esquerda" | "direita";

export function SetasLaterais({ aberta, expandida, aoAlternar }: {
  aberta: LadoDaIlha | null;
  expandida: boolean;
  aoAlternar: (lado: LadoDaIlha) => void;
}) {
  return (
    <div className="ilha-comandos-laterais">
      <button type="button" className="ilha-seta-lateral" data-lado="esquerda" aria-label={`${aberta === "esquerda" ? "Recolher" : "Mostrar"} materiais à esquerda`} title="Materiais" aria-expanded={aberta === "esquerda"} aria-controls="ilha-lateral-esquerda" onClick={() => aoAlternar("esquerda")}>
        {aberta === "esquerda" ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
      <span aria-hidden="true">{expandida ? "Kyro" : ""}</span>
      <button type="button" className="ilha-seta-lateral" data-lado="direita" aria-label={`${aberta === "direita" ? "Recolher" : "Mostrar"} controles à direita`} title="Controles rápidos" aria-expanded={aberta === "direita"} aria-controls="ilha-lateral-direita" onClick={() => aoAlternar("direita")}>
        {aberta === "direita" ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>
    </div>
  );
}
