import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { Botao } from "../../componentes/basicos";
import { buscarHistoricoSincronia, idDoCliente, modoArmazenamento, type RegistroHistoricoSincronia } from "../../ponte/armazenamento";

function nomeDoDispositivo(clienteId: string | null, atual: string | null): string {
  if (!clienteId) return "Dispositivo não identificado";
  return clienteId === atual ? "Este dispositivo" : "Outro dispositivo";
}

function dataFormatada(valor: string): string {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function HistoricoSincronia() {
  const [registros, setRegistros] = useState<RegistroHistoricoSincronia[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [clienteAtual, setClienteAtual] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const historico = await buscarHistoricoSincronia(30);
      setRegistros(historico);
      setClienteAtual(idDoCliente());
    } catch {
      setErro("Não foi possível carregar o histórico agora.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (modoArmazenamento() === "banco") void carregar();
  }, [carregar]);

  return (
    <section className="historico-sincronia" aria-labelledby="historico-sincronia-titulo">
      <div className="historico-sincronia-cabecalho">
        <div className="ajuste-texto">
          <History size={16} aria-hidden="true" />
          <span className="ajuste-texto-coluna">
            <strong id="historico-sincronia-titulo" className="ajuste-rotulo">Histórico de sincronização</strong>
            <span className="ajuste-dica">Registra ações e chaves alteradas, sem salvar os valores dos seus dados.</span>
          </span>
        </div>
        <Botao pequeno variante="fantasma" icone={<RefreshCw size={13} />} disabled={carregando || modoArmazenamento() !== "banco"} onClick={() => void carregar()}>
          Atualizar
        </Botao>
      </div>
      {modoArmazenamento() !== "banco" && <p className="historico-sincronia-vazio">O histórico fica disponível quando a conta estiver conectada.</p>}
      {erro && <p className="historico-sincronia-erro" role="alert">{erro}</p>}
      {!erro && modoArmazenamento() === "banco" && registros.length === 0 && !carregando && <p className="historico-sincronia-vazio">Nenhuma alteração registrada ainda.</p>}
      {carregando && <p className="historico-sincronia-vazio">Carregando histórico...</p>}
      {registros.length > 0 && (
        <div className="historico-sincronia-lista">
          {registros.map((registro) => (
            <article className="historico-sincronia-item" key={`${registro.versao}-${registro.criadoEm}`}>
              <div>
                <strong>{registro.operacao === "zerar" ? "Dados apagados" : "Dados sincronizados"}</strong>
                <span>{dataFormatada(registro.criadoEm)} · {nomeDoDispositivo(registro.clienteId, clienteAtual)}</span>
              </div>
              <span className="historico-sincronia-chaves">
                {registro.operacao === "zerar" ? "Todos os dados" : `${registro.chaves.length} ${registro.chaves.length === 1 ? "chave alterada" : "chaves alteradas"}`}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
