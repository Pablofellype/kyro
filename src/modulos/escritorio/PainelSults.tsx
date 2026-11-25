import { ClipboardCheck } from "lucide-react";
import { Vazio } from "../../componentes/basicos";

export default function PainelSults() {
  return <>
    <h1 className="titulo-pagina">SULTS</h1>
    <Vazio icone={<ClipboardCheck size={26} aria-hidden="true" />} titulo="Em breve no Kyro" />
  </>;
}
