import { useEffect, useState } from "react";
import { FileSpreadsheet, Users } from "lucide-react";
import { useAuth } from "../../estado/autenticacao";
import { Aderencias } from "./Aderencias";
import { PainelCoordenacao } from "./PainelCoordenacao";

type TipoEscritorio = "coordenacao" | "aderencias";

export default function Escritorio({ tipoInicial = "coordenacao" }: { tipoInicial?: "niko" | "coordenacao" | "aderencias" } = {}) {
  const [tipo, setTipo] = useState<TipoEscritorio>(tipoInicial === "niko" ? "coordenacao" : tipoInicial);
  const usuario = useAuth((s) => s.usuario);
  const podeAderencias = usuario?.perfil === "dono" || usuario?.roboAderencias === true;

  useEffect(() => {
    if (!podeAderencias && tipo === "aderencias") setTipo("coordenacao");
  }, [podeAderencias, tipo]);

  const abas = [
    ["coordenacao", Users, "Coordenação", "Equipe, agenda e pendências da empresa"] as const,
    ...(podeAderencias ? [["aderencias", FileSpreadsheet, "Aderências", "Registros e acompanhamento operacional"] as const] : []),
  ];

  const alternador = (
    <div className="escritorio-troca" role="tablist" aria-label="Área da empresa">
      {abas.map(([id, Icone, titulo, dica]) => (
        <button key={id} type="button" role="tab" aria-selected={tipo === id} className="escritorio-troca-botao" onClick={() => setTipo(id)}>
          <span className="escritorio-troca-icone"><Icone size={18} /></span>
          <span className="escritorio-troca-texto"><b>{titulo}</b><small>{dica}</small></span>
        </button>
      ))}
    </div>
  );

  if (tipo === "aderencias") return <>{alternador}<Aderencias /></>;
  return <>{alternador}<PainelCoordenacao /></>;
}
