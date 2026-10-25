import { Check, Cloud, CloudOff, HardDrive, RefreshCw } from "lucide-react";
import { useSyncExternalStore } from "react";
import { aoMudarSincronia, lerSituacaoSincronia, type EstadoSincronia } from "../ponte/armazenamento";

function usarSituacaoSincronia() {
  return useSyncExternalStore(aoMudarSincronia, lerSituacaoSincronia, lerSituacaoSincronia);
}

const textos: Record<EstadoSincronia, { curto: string; completo: string }> = {
  local: { curto: "Local", completo: "Salvo neste dispositivo" },
  conectado: { curto: "Sincronizado", completo: "Sincronizado com a conta" },
  sincronizando: { curto: "Salvando", completo: "Salvando alterações" },
  pendente: { curto: "Pendente", completo: "Há alterações aguardando sincronização" },
  offline: { curto: "Offline", completo: "Sem conexão com a conta. As alterações ficam pendentes" },
  conflito: { curto: "Mesclando", completo: "Uma alteração de outro dispositivo foi mesclada" },
};

function IconeDaSituacao({ estado }: { estado: EstadoSincronia }) {
  if (estado === "local") return <HardDrive size={14} aria-hidden="true" />;
  if (estado === "offline") return <CloudOff size={14} aria-hidden="true" />;
  if (estado === "sincronizando" || estado === "pendente" || estado === "conflito") return <RefreshCw size={14} aria-hidden="true" className={estado === "sincronizando" ? "sincronia-girando" : undefined} />;
  if (estado === "conectado") return <Check size={14} aria-hidden="true" />;
  return <Cloud size={14} aria-hidden="true" />;
}

export function IndicadorSincronia({ recolhida }: { recolhida: boolean }) {
  const situacao = usarSituacaoSincronia();
  // Sem conta conectada, o estado local não acrescenta informação útil à barra.
  if (situacao.estado === "local") return null;
  const texto = textos[situacao.estado];
  const pendentes = situacao.pendentes > 0 ? ` (${situacao.pendentes})` : "";
  return (
    <div className={`barra-sincronia barra-sincronia-${situacao.estado}`} role="status" aria-live="polite" title={texto.completo}>
      <span className="barra-sincronia-icone"><IconeDaSituacao estado={situacao.estado} /></span>
      {!recolhida && <span className="cortar">{texto.curto}{pendentes}</span>}
    </div>
  );
}
