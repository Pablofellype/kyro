import { useCallback, useEffect, useState } from "react";
import { Cloud, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Botao, AvisoFaixa } from "../../componentes/basicos";
import { cabecalhosNiko, useAuth, urlApi } from "../../estado/autenticacao";

interface Fatura {
  valorUsd: number | null;
  periodo: string | null;
  id: string | null;
}

interface DadosCustos {
  provedor: string;
  atualizadoEm: string;
  balance: {
    usoMesUsd: number | null;
    usoMesBrl: number | null;
    saldoContaUsd: number | null;
    saldoContaBrl: number | null;
    saldoMesUsd: number | null;
    saldoMesBrl: number | null;
  };
  cotacao: { usdBrl: number | null; atualizadaEm: string | null };
  previa: Fatura | null;
  faturas: Fatura[];
}

function dinheiro(valor: number | null, moeda: "BRL" | "USD") {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: moeda });
}

function data(valor: string | null | undefined) {
  if (!valor) return "—";
  const lida = new Date(`${valor}-01T12:00:00`);
  return Number.isNaN(lida.getTime()) ? valor : lida.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

async function respostaJson(res: Response): Promise<Record<string, unknown>> {
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof dados.erro === "string" ? dados.erro : `http_${res.status}`);
  return dados as Record<string, unknown>;
}

function mensagemDoErro(erro: unknown) {
  if (!(erro instanceof Error)) return "Não foi possível consultar os custos.";
  if (erro.message === "digitalocean_token_nao_configurado") return "O token da DigitalOcean ainda não está disponível neste deployment.";
  if (erro.message === "digitalocean_token_recusado") return "A DigitalOcean recusou o token. Confira se ele tem a permissão billing:read.";
  return "Não foi possível consultar os custos agora.";
}

export function CustosDigitalOcean() {
  const token = useAuth((s) => s.token);
  const usuario = useAuth((s) => s.usuario);
  const [dados, setDados] = useState<DadosCustos | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!token || usuario?.perfil !== "dono") return;
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch(urlApi("/api/custos"), { headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}` } });
      const bruto = await respostaJson(resposta);
      setDados(bruto as unknown as DadosCustos);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setCarregando(false);
    }
  }, [token, usuario?.perfil]);

  useEffect(() => { void carregar(); }, [carregar]);

  if (carregando && !dados) {
    return <div className="admin-custos admin-custos-carregando"><LoaderCircle size={17} className="girando" /> Consultando custos da DigitalOcean...</div>;
  }

  return (
    <section className="admin-custos" aria-label="Custos da DigitalOcean">
      <div className="admin-custos-cabecalho">
        <div className="admin-custos-titulo">
          <span className="admin-custos-icone"><Cloud size={17} /></span>
          <div><h3>Custos do VPS</h3><p>Leitura somente dos gastos da conta DigitalOcean.</p></div>
        </div>
        <Botao pequeno icone={<RefreshCw size={13} />} onClick={() => void carregar()} disabled={carregando}>
          {carregando ? "Consultando..." : "Atualizar"}
        </Botao>
      </div>

      {erro && <AvisoFaixa tipo="erro"><span className="linha"><TriangleAlert size={13} />{erro}</span></AvisoFaixa>}
      {dados && (
        <>
          <div className="admin-custos-metricas">
            <div className="admin-custos-metrica"><span>Uso neste mês</span><strong>{dinheiro(dados.balance.usoMesBrl, "BRL")}</strong><small>{dinheiro(dados.balance.usoMesUsd, "USD")}</small></div>
            <div className="admin-custos-metrica"><span>Saldo da conta</span><strong>{dinheiro(dados.balance.saldoContaBrl, "BRL")}</strong><small>{dinheiro(dados.balance.saldoContaUsd, "USD")}</small></div>
            <div className="admin-custos-metrica"><span>Prévia da fatura</span><strong>{dinheiro(dados.previa?.valorUsd !== null && dados.previa ? (dados.previa.valorUsd ?? 0) * (dados.cotacao.usdBrl ?? 0) : null, "BRL")}</strong><small>{dados.previa ? dinheiro(dados.previa.valorUsd, "USD") : "Ainda não disponível"}</small></div>
          </div>
          <div className="admin-custos-nota">
            <span>Cotação usada: {dados.cotacao.usdBrl ? `US$ 1 = ${dinheiro(dados.cotacao.usdBrl, "BRL")}` : "indisponível"}</span>
            <span>Atualizado em {new Date(dados.atualizadoEm).toLocaleString("pt-BR")}</span>
          </div>
          {dados.faturas.length > 0 && (
            <div className="admin-custos-faturas">
              <div className="admin-custos-lista-cabecalho"><strong>Faturas recentes</strong><span>{dados.faturas.length}</span></div>
              {dados.faturas.slice(0, 6).map((fatura, indice) => <div className="admin-custos-fatura" key={`${fatura.id ?? fatura.periodo ?? "fatura"}-${indice}`}><span>{data(fatura.periodo)}</span><strong>{dinheiro(fatura.valorUsd, "USD")}</strong></div>)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
