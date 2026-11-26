import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { BlobNotFoundError, get, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { TIPOS_DE_ANEXO, TIPOS_PROPOSTA, type AnexoProposta, type PropostaAplicativo, type TipoProposta } from "../modulos/escritorio/aplicativosEmpresaConfig.ts";

export class ErroProposta extends Error {
  readonly status: number;

  constructor(status: number, codigo: string) {
    super(codigo);
    this.status = status;
  }
}

const prefixo = (id: string) => `kyro/propostas/${id}/`;
const limiteBytes = (tipo: TipoProposta) => TIPOS_PROPOSTA[tipo].limiteMb * 1024 * 1024;

function tokenDoArmazenamento(): string {
  const token = process.env.KYRO_PROPOSTAS_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new ErroProposta(503, "armazenamento_propostas_indisponivel");
  return token;
}

export function tipoPropostaValido(tipo: unknown): tipo is TipoProposta {
  return tipo === "pdf" || tipo === "video";
}

function caminhoValido(id: string, tipo: TipoProposta, caminho: unknown): caminho is string {
  if (typeof caminho !== "string" || !caminho.startsWith(prefixo(id))) return false;
  const [uuid, extensao, sobrando] = caminho.slice(prefixo(id).length).split(".");
  return sobrando === undefined && extensao === TIPOS_PROPOSTA[tipo].extensao && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uuid);
}

function validarAnexo(valor: unknown, tipo: TipoProposta, id: string): AnexoProposta {
  if (valor && typeof valor === "object" && "origem" in valor) {
    if (valor.origem === "link" && "url" in valor && typeof valor.url === "string" && valor.url.length <= 2048) {
      const endereco = valor.url.trim();
      if (URL.canParse(endereco)) {
        const url = new URL(endereco);
        if (url.protocol === "https:" && !url.username && !url.password && url.href.length <= 2048) return { origem: "link", url: url.href };
      }
    }
    if (valor.origem === "arquivo" && "nome" in valor && typeof valor.nome === "string" && "caminho" in valor && caminhoValido(id, tipo, valor.caminho)) {
      const nome = valor.nome.trim();
      if (nome && nome.length <= 160 && !/[\x00-\x1f\x7f/\\]/.test(nome)) return { origem: "arquivo", nome, caminho: valor.caminho };
    }
  }
  throw new ErroProposta(400, "proposta_invalida");
}

export function validarProposta(valor: unknown, id: string): PropostaAplicativo | undefined {
  if (valor === undefined) return undefined;
  if (!valor || typeof valor !== "object" || Array.isArray(valor) || Object.keys(valor).some((tipo) => !tipoPropostaValido(tipo))) {
    throw new ErroProposta(400, "proposta_invalida");
  }
  const dados = valor as Record<string, unknown>;
  const proposta: PropostaAplicativo = {};
  for (const tipo of TIPOS_DE_ANEXO) {
    if (dados[tipo] !== undefined) proposta[tipo] = validarAnexo(dados[tipo], tipo, id);
  }
  return proposta;
}

export async function autorizarUploadProposta(id: string, tipo: TipoProposta) {
  const { extensao, mime } = TIPOS_PROPOSTA[tipo];
  const caminho = `${prefixo(id)}${randomUUID()}.${extensao}`;
  const token = await generateClientTokenFromReadWriteToken({
    pathname: caminho, token: tokenDoArmazenamento(), allowedContentTypes: [mime],
    maximumSizeInBytes: limiteBytes(tipo), validUntil: Date.now() + 15 * 60_000,
    allowOverwrite: false, addRandomSuffix: false,
  });
  return { caminho, token };
}

export async function confirmarArquivosProposta(proposta: PropostaAplicativo | undefined, anterior: PropostaAplicativo | undefined) {
  await Promise.all(TIPOS_DE_ANEXO.map(async (tipo) => {
    const anexo = proposta?.[tipo];
    const salvo = anterior?.[tipo];
    if (anexo?.origem !== "arquivo" || (salvo?.origem === "arquivo" && salvo.caminho === anexo.caminho)) return;
    const token = tokenDoArmazenamento();
    const info = await head(anexo.caminho, { token, abortSignal: AbortSignal.timeout(8000) }).catch((erro: unknown) => {
      if (erro instanceof BlobNotFoundError) throw new ErroProposta(400, "arquivo_proposta_invalido");
      throw erro;
    });
    if (info.pathname !== anexo.caminho || info.contentType !== TIPOS_PROPOSTA[tipo].mime || info.size < 1 || info.size > limiteBytes(tipo)) {
      throw new ErroProposta(400, "arquivo_proposta_invalido");
    }
  }));
}

export async function lerArquivoProposta(id: string, tipo: TipoProposta, anexo: AnexoProposta | undefined) {
  if (anexo?.origem !== "arquivo" || !caminhoValido(id, tipo, anexo.caminho)) return null;
  const resultado = await get(anexo.caminho, {
    access: "private", token: tokenDoArmazenamento(), abortSignal: AbortSignal.timeout(90_000),
  });
  if (!resultado || resultado.statusCode !== 200) return null;
  const { mime, extensao } = TIPOS_PROPOSTA[tipo];
  const { size, contentType } = resultado.blob;
  if (contentType !== mime || !Number.isSafeInteger(size) || size < 1 || size > limiteBytes(tipo)) {
    await resultado.stream.cancel().catch(() => undefined);
    return null;
  }
  return { stream: resultado.stream, mime, extensao, tamanho: size };
}

export type ArquivoProposta = NonNullable<Awaited<ReturnType<typeof lerArquivoProposta>>>;

export async function responderArquivoProposta(res: ServerResponse, arquivo: ArquivoProposta) {
  res.writeHead(200, {
    "Content-Type": arquivo.mime,
    "Content-Length": arquivo.tamanho,
    "Content-Disposition": `attachment; filename="proposta.${arquivo.extensao}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  await pipeline(Readable.fromWeb(arquivo.stream as import("node:stream/web").ReadableStream<Uint8Array>), res).catch(() => res.destroy());
}
