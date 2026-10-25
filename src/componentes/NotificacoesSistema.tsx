import { useEffect } from "react";
import { useInterface } from "../estado/interface";

const INTERVALO_FALHA = 30_000;

export function NotificacoesSistema() {
  useEffect(() => {
    let ultimaFalha = 0;
    const conflito = () => {
      useInterface.getState().avisar("Uma alteração de outro dispositivo foi mesclada.", undefined, "alerta");
    };
    const falha = () => {
      if (Date.now() - ultimaFalha < INTERVALO_FALHA) return;
      ultimaFalha = Date.now();
      useInterface.getState().avisar("Sem conexão: sua alteração ficará pendente e será enviada depois.", undefined, "alerta");
    };
    const restabelecida = () => {
      useInterface.getState().avisar("Conexão restabelecida. Alterações sincronizadas.", undefined, "sucesso");
    };
    window.addEventListener("niko:sincronizacao-conflito", conflito);
    window.addEventListener("niko:armazenamento-falhou", falha);
    window.addEventListener("niko:sincronizacao-restabelecida", restabelecida);
    return () => {
      window.removeEventListener("niko:sincronizacao-conflito", conflito);
      window.removeEventListener("niko:armazenamento-falhou", falha);
      window.removeEventListener("niko:sincronizacao-restabelecida", restabelecida);
    };
  }, []);

  return null;
}
