import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validarSessao } from "../src/servicos/autenticacao.js";
import { ConflitoDadosUsuario, gravarDadosUsuario, lerBackupsDadosUsuario, lerDadosUsuarioComVersao, lerHistoricoDadosUsuario, restaurarBackupDadosUsuario, validarItensDadosUsuario, zerarDadosUsuario } from "../src/servicos/dadosUsuario.js";

function tokenDaRequisicao(req: VercelRequest): string {
  const valor = req.headers.authorization;
  return typeof valor === "string" && valor.startsWith("Bearer ") ? valor.slice(7).trim() : "";
}

function clienteDaRequisicao(req: VercelRequest): string | null {
  const valor = req.headers["x-niko-cliente"];
  return typeof valor === "string" ? valor : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Niko, X-Niko-Cliente");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = tokenDaRequisicao(req);
  const usuario = token ? await validarSessao(token) : null;
  if (!usuario) return res.status(401).json({ erro: "nao_autenticado" });

  try {
    if (req.method === "GET") {
      if (req.query.acao === "historico") {
        const limite = typeof req.query.limite === "string" ? Number(req.query.limite) : 30;
        return res.status(200).json({ registros: await lerHistoricoDadosUsuario(usuario.id, limite) });
      }
      if (req.query.acao === "backups") {
        const limite = typeof req.query.limite === "string" ? Number(req.query.limite) : 30;
        return res.status(200).json({ backups: await lerBackupsDadosUsuario(usuario.id, limite) });
      }
      const atual = await lerDadosUsuarioComVersao(usuario.id);
      const desde = typeof req.query.desde === "string" ? req.query.desde : "";
      if (desde && desde === atual.versao) return res.status(200).json({ alterado: false, versao: atual.versao });
      return res.status(200).json({ alterado: true, ...atual });
    }

    if (req.method === "POST" && req.query.acao === "zerar") {
      if (req.body?.confirmacao !== "APAGAR") return res.status(400).json({ erro: "confirmacao_invalida" });
      const versao = typeof req.body.versao === "string" ? req.body.versao : null;
      const novaVersao = await zerarDadosUsuario(usuario.id, versao, clienteDaRequisicao(req));
      return res.status(200).json({ ok: true, versao: novaVersao });
    }

    if (req.method === "POST" && req.query.acao === "restaurar") {
      const corpo = req.body && typeof req.body === "object" ? req.body : {};
      const id = typeof corpo.id === "number" ? corpo.id : Number(corpo.id);
      const versao = typeof corpo.versao === "string" ? corpo.versao : null;
      const novaVersao = await restaurarBackupDadosUsuario(usuario.id, id, versao, clienteDaRequisicao(req));
      return res.status(200).json({ ok: true, versao: novaVersao });
    }

    if (req.method === "POST") {
      const corpo = req.body && typeof req.body === "object" ? req.body : {};
      const versao = typeof corpo.versao === "string" ? corpo.versao : null;
      const novaVersao = await gravarDadosUsuario(usuario.id, validarItensDadosUsuario(corpo.itens), versao, clienteDaRequisicao(req));
      return res.status(200).json({ ok: true, versao: novaVersao });
    }

    return res.status(405).json({ erro: "metodo_nao_permitido" });
  } catch (erro) {
    if (erro instanceof ConflitoDadosUsuario) return res.status(409).json({ erro: "conflito_sincronizacao", versao: erro.versao, dados: erro.dados });
    return res.status(400).json({ erro: (erro as Error).message });
  }
}
