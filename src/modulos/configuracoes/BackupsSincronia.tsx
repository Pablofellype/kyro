import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup, RefreshCw } from "lucide-react";
import { Botao, ConfirmarModal } from "../../componentes/basicos";
import { buscarBackupsSincronia, modoArmazenamento, restaurarBackupSincronia, type RegistroBackupSincronia } from "../../ponte/armazenamento";

function dataFormatada(valor: string): string {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function tituloDoMotivo(motivo: RegistroBackupSincronia["motivo"]): string {
  if (motivo === "zerar") return "Antes de apagar os dados";
  if (motivo === "manual") return "Cópia manual";
  return "Cópia automática";
}

export function BackupsSincronia() {
  const [backups, setBackups] = useState<RegistroBackupSincronia[]>([]);
  const [alvo, setAlvo] = useState<RegistroBackupSincronia | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      setBackups(await buscarBackupsSincronia(30));
    } catch {
      setErro("Não foi possível carregar os backups agora.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (modoArmazenamento() === "banco") void carregar();
  }, [carregar]);

  const restaurar = async () => {
    if (!alvo || restaurando) return;
    setRestaurando(true);
    try {
      await restaurarBackupSincronia(alvo.id);
      window.location.reload();
    } catch {
      setRestaurando(false);
      setAlvo(null);
      setErro("Não foi possível restaurar este backup. Os dados atuais foram preservados.");
    }
  };

  return (
    <section className="backups-sincronia" aria-labelledby="backups-sincronia-titulo">
      <div className="backups-sincronia-cabecalho">
        <div className="ajuste-texto">
          <DatabaseBackup size={16} aria-hidden="true" />
          <span className="ajuste-texto-coluna">
            <strong id="backups-sincronia-titulo" className="ajuste-rotulo">Backups automáticos da conta</strong>
            <span className="ajuste-dica">Até 30 cópias recentes ficam disponíveis para recuperar dados entre dispositivos.</span>
          </span>
        </div>
        <Botao pequeno variante="fantasma" icone={<RefreshCw size={13} />} disabled={carregando || modoArmazenamento() !== "banco"} onClick={() => void carregar()}>
          Atualizar
        </Botao>
      </div>
      {modoArmazenamento() !== "banco" && <p className="backups-sincronia-vazio">Disponível quando a conta estiver conectada.</p>}
      {erro && <p className="backups-sincronia-erro" role="alert">{erro}</p>}
      {!erro && modoArmazenamento() === "banco" && backups.length === 0 && !carregando && <p className="backups-sincronia-vazio">Nenhum backup automático disponível ainda.</p>}
      {carregando && <p className="backups-sincronia-vazio">Carregando backups...</p>}
      {backups.length > 0 && (
        <div className="backups-sincronia-lista">
          {backups.map((backup) => (
            <article className="backups-sincronia-item" key={backup.id}>
              <div>
                <strong>{tituloDoMotivo(backup.motivo)}</strong>
                <span>{dataFormatada(backup.criadoEm)} · {backup.itens} {backup.itens === 1 ? "item" : "itens"}</span>
              </div>
              <Botao pequeno variante="fantasma" disabled={restaurando} onClick={() => setAlvo(backup)}>Restaurar</Botao>
            </article>
          ))}
        </div>
      )}
      <ConfirmarModal
        aberto={!!alvo}
        titulo="Restaurar backup"
        texto="Os dados atuais desta conta serão substituídos pela cópia escolhida. Deseja continuar?"
        rotuloConfirmar={restaurando ? "Restaurando..." : "Restaurar"}
        aoFechar={() => { if (!restaurando) setAlvo(null); }}
        aoConfirmar={() => void restaurar()}
      />
    </section>
  );
}
