import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validarSessao } from "../src/servicos/autenticacao.js";
import { lerCotacoes } from "../servidor/cotacoes.js";
import { configurarCors } from "./cors.js";

const DIGITALOCEAN = "https://api.digitalocean.com/v2";

interface BalanceDigitalOcean {
  account_balance?: string;
  month_to_date_balance?: string;
  month_to_date_usage?: string;
  generated_at?: string;
}

interface InvoiceDigitalOcean {
  amount?: string;
  invoice_id?: string;
  invoice_period?: string;
  invoice_uuid?: string;
}

function tokenDaRequisicao(req: VercelRequest): string {
  const valor = req.headers.authorization;
  return typeof valor === "string" && valor.startsWith("Bearer ") ? valor.slice(7).trim() : "";
}

function numero(valor: unknown): number | null {
  const n = typeof valor === "string" || typeof valor === "number" ? Number(valor) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function digitalOcean<T>(caminho: string, token: string): Promise<T> {
  const resposta = await fetch(`${DIGITALOCEAN}${caminho}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!resposta.ok) throw new Error(`digitalocean_${resposta.status}`);
  return await resposta.json() as T;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurarCors(req, res)) return res.status(403).json({ erro: "origem_nao_permitida" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ erro: "metodo_nao_permitido" });

  const token = tokenDaRequisicao(req);
  const usuario = token ? await validarSessao(token) : null;
  if (!usuario) return res.status(401).json({ erro: "nao_autenticado" });
  if (usuario.perfil !== "dono") return res.status(403).json({ erro: "permissao_negada" });

  const apiToken = process.env.DIGITALOCEAN_API_TOKEN?.trim();
  if (!apiToken) return res.status(503).json({ erro: "digitalocean_token_nao_configurado" });

  try {
    const [balance, invoices] = await Promise.all([
      digitalOcean<BalanceDigitalOcean>("/customers/my/balance", apiToken),
      digitalOcean<{ invoice_preview?: InvoiceDigitalOcean; invoices?: InvoiceDigitalOcean[] }>("/customers/my/invoices?per_page=12", apiToken),
    ]);

    let usdBrl: number | null = null;
    let cotacaoAtualizadaEm: string | null = null;
    try {
      const cotacao = await lerCotacoes();
      usdBrl = cotacao.USD;
      cotacaoAtualizadaEm = cotacao.atualizadaEm;
    } catch {
      // A cobrança continua disponível em dólar mesmo sem a cotação.
    }

    const usoUsd = numero(balance.month_to_date_usage);
    const saldoContaUsd = numero(balance.account_balance);
    const saldoMesUsd = numero(balance.month_to_date_balance);
    const convertido = (valor: number | null) => valor !== null && usdBrl !== null ? valor * usdBrl : null;

    return res.status(200).json({
      provedor: "DigitalOcean",
      atualizadoEm: balance.generated_at ?? new Date().toISOString(),
      balance: {
        usoMesUsd: usoUsd,
        usoMesBrl: convertido(usoUsd),
        saldoContaUsd,
        saldoContaBrl: convertido(saldoContaUsd),
        saldoMesUsd,
        saldoMesBrl: convertido(saldoMesUsd),
      },
      cotacao: { usdBrl, atualizadaEm: cotacaoAtualizadaEm },
      previa: invoices.invoice_preview ? {
        valorUsd: numero(invoices.invoice_preview.amount),
        periodo: invoices.invoice_preview.invoice_period ?? null,
        id: invoices.invoice_preview.invoice_id ?? null,
      } : null,
      faturas: (invoices.invoices ?? []).slice(0, 12).map((fatura) => ({
        valorUsd: numero(fatura.amount),
        periodo: fatura.invoice_period ?? null,
        id: fatura.invoice_id ?? null,
      })),
    });
  } catch (erro) {
    const mensagem = (erro as Error).message;
    const status = mensagem === "digitalocean_401" || mensagem === "digitalocean_403" ? 502 : 503;
    return res.status(status).json({ erro: status === 502 ? "digitalocean_token_recusado" : "digitalocean_indisponivel" });
  }
}
