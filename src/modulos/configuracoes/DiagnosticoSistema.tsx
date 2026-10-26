import { Check, Clipboard, Cloud, MonitorCheck, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Botao } from "../../componentes/basicos";
import { useAuth } from "../../estado/autenticacao";
import { useInterface } from "../../estado/interface";
import { modoArmazenamento, listarChaves, lerSituacaoSincronia, aoMudarSincronia, tamanhoGuardado, type EstadoSincronia } from "../../ponte/armazenamento";
import { endpointTempoReal } from "../../ponte/tempoReal";
import { NATIVO } from "../../desktop/desktop";
import { T } from "../../textos/textos";

function assinarRede(ouvinte: () => void) {
  window.addEventListener("online", ouvinte);
  window.addEventListener("offline", ouvinte);
  return () => {
    window.removeEventListener("online", ouvinte);
    window.removeEventListener("offline", ouvinte);
  };
}

function lerRede() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function textoData(valor: number | null) {
  if (!valor) return "Ainda não sincronizado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
}

function rotuloSincronia(estado: EstadoSincronia) {
  const rotulos: Record<EstadoSincronia, string> = {
    local: "Somente neste dispositivo",
    conectado: "Sincronizado",
    sincronizando: "Salvando agora",
    pendente: "Alterações pendentes",
    offline: "Sem conexão",
    conflito: "Mesclando alterações",
  };
  return rotulos[estado];
}

function ItemDiagnostico({ rotulo, valor, detalhe, estado = "neutro" }: { rotulo: string; valor: string; detalhe?: string; estado?: "ok" | "alerta" | "neutro" }) {
  const Icone = estado === "ok" ? Check : estado === "alerta" ? WifiOff : MonitorCheck;
  return (
    <div className={`diagnostico-sistema-item diagnostico-sistema-item-${estado}`}>
      <span className="diagnostico-sistema-icone"><Icone size={14} aria-hidden="true" /></span>
      <div>
        <span className="diagnostico-sistema-rotulo">{rotulo}</span>
        <strong>{valor}</strong>
        {detalhe && <small>{detalhe}</small>}
      </div>
    </div>
  );
}

export function DiagnosticoSistema() {
  const usuario = useAuth((estado) => estado.usuario);
  const verificarSessao = useAuth((estado) => estado.verificar);
  const avisar = useInterface((estado) => estado.avisar);
  const situacao = useSyncExternalStore(aoMudarSincronia, lerSituacaoSincronia, lerSituacaoSincronia);
  const online = useSyncExternalStore(assinarRede, lerRede, () => true);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const armazenamento = modoArmazenamento();
  const dadosCopiar = useMemo(() => [
    `Kyro ${T.app.versao}`,
    `Ambiente: ${NATIVO ? "aplicativo desktop" : "navegador"}`,
    `Conta: ${usuario?.email ?? "não conectada"}`,
    `Armazenamento: ${armazenamento === "banco" ? "banco remoto" : "local"}`,
    `Rede: ${online ? "conectada" : "offline"}`,
    `Sincronização: ${rotuloSincronia(situacao.estado)}`,
    `Pendências: ${situacao.pendentes}`,
    `Última sincronização: ${textoData(situacao.ultimaSincronia)}`,
    `Tempo real: ${endpointTempoReal() ? "ponte local disponível" : "servidor web"}`,
    `Dados locais: ${listarChaves().length} coleções / ${(tamanhoGuardado() / 1024).toFixed(0)} KB`,
  ].join("\n"), [armazenamento, online, situacao, usuario?.email]);

  useEffect(() => {
    if (!copiado) return;
    const temporizador = window.setTimeout(() => setCopiado(false), 1800);
    return () => window.clearTimeout(temporizador);
  }, [copiado]);

  const testarSessao = async () => {
    if (verificando) return;
    setVerificando(true);
    try {
      const valido = usuario ? await verificarSessao() : false;
      avisar(valido ? "Diagnóstico concluído: conta autorizada." : "Diagnóstico concluído: nenhuma conta autorizada.", undefined, valido ? "sucesso" : "alerta");
    } catch {
      avisar("Não foi possível verificar a conta agora.", undefined, "erro");
    } finally {
      setVerificando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(dadosCopiar);
      setCopiado(true);
      avisar("Diagnóstico copiado.", undefined, "sucesso");
    } catch {
      avisar("Não foi possível copiar o diagnóstico.", undefined, "erro");
    }
  };

  const estadoRede = online ? "ok" : "alerta";
  const estadoSincronia = situacao.estado === "conectado" ? "ok" : situacao.estado === "offline" ? "alerta" : "neutro";

  return (
    <section className="diagnostico-sistema" aria-labelledby="diagnostico-sistema-titulo">
      <div className="diagnostico-sistema-cabecalho">
        <div className="ajuste-texto">
          <Cloud size={15} aria-hidden="true" />
          <div className="ajuste-texto-coluna">
            <strong id="diagnostico-sistema-titulo" className="ajuste-rotulo">{T.configuracoes.diagnosticoTitulo}</strong>
            <span className="ajuste-dica">{T.configuracoes.diagnosticoDica}</span>
          </div>
        </div>
        <div className="diagnostico-sistema-acoes">
          <Botao pequeno icone={<RefreshCw size={13} />} disabled={verificando} onClick={() => void testarSessao()}>{verificando ? T.configuracoes.diagnosticoVerificando : T.configuracoes.diagnosticoAtualizar}</Botao>
          <Botao pequeno icone={copiado ? <Check size={13} /> : <Clipboard size={13} />} onClick={() => void copiar()}>{copiado ? T.configuracoes.diagnosticoCopiado : T.configuracoes.diagnosticoCopiar}</Botao>
        </div>
      </div>
      <div className="diagnostico-sistema-grade">
        <ItemDiagnostico rotulo={T.configuracoes.diagnosticoConta} valor={usuario?.email ?? T.configuracoes.diagnosticoSemConta} detalhe={usuario ? "Conta autorizada" : "Faça login para sincronizar"} estado={usuario ? "ok" : "alerta"} />
        <ItemDiagnostico rotulo={T.configuracoes.diagnosticoRede} valor={online ? "Conectada" : "Offline"} detalhe={online ? "Acesso à rede disponível" : "As alterações ficam na fila"} estado={estadoRede} />
        <ItemDiagnostico rotulo={T.configuracoes.diagnosticoArmazenamento} valor={armazenamento === "banco" ? "Banco remoto" : "Local"} detalhe={`${listarChaves().length} coleções / ${(tamanhoGuardado() / 1024).toFixed(0)} KB`} estado={armazenamento === "banco" ? "ok" : "neutro"} />
        <ItemDiagnostico rotulo={T.configuracoes.diagnosticoSincronia} valor={rotuloSincronia(situacao.estado)} detalhe={`${situacao.pendentes} pendência(s) · ${textoData(situacao.ultimaSincronia)}`} estado={estadoSincronia} />
        <ItemDiagnostico rotulo={T.configuracoes.diagnosticoTempoReal} valor={endpointTempoReal() ? "Ponte local" : "HTTP periódico"} detalhe={endpointTempoReal() ? "WebSocket do aplicativo disponível" : "Sincronização periódica pelo servidor web"} />
        <ItemDiagnostico rotulo={T.configuracoes.diagnosticoAmbiente} valor={NATIVO ? "Aplicativo desktop" : "Navegador"} detalhe={`Kyro ${T.app.versao}`} />
      </div>
    </section>
  );
}
