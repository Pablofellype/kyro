import { upload } from "@vercel/blob/client";
import { urlApi } from "../estado/autenticacao";

export type CategoriaFoto = "perfil" | "materiais";

const TIPOS_DE_IMAGEM = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const LIMITE_DE_IMAGEM = 8 * 1024 * 1024;

function idAleatorio(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function tokenDaSessao(): string | null {
  try {
    return localStorage.getItem("kyro_token")?.trim() || null;
  } catch {
    return null;
  }
}

function usuarioIdDaSessao(): number | null {
  try {
    const usuario = JSON.parse(localStorage.getItem("kyro_usuario") ?? "null") as { id?: unknown } | null;
    return typeof usuario?.id === "number" && Number.isSafeInteger(usuario.id) && usuario.id > 0 ? usuario.id : null;
  } catch {
    return null;
  }
}

export async function uploadarFoto(foto: Blob, categoria: CategoriaFoto): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const token = tokenDaSessao();
  const usuarioId = usuarioIdDaSessao();
  if (!token || !usuarioId) return null;

  const pasta = categoria === "perfil" ? "perfil" : "materiais";
  const caminho = `kyro/usuarios/${usuarioId}/${pasta}/${idAleatorio()}.jpg`;
  try {
    const resultado = await upload(caminho, foto, {
      access: "public",
      contentType: "image/jpeg",
      handleUploadUrl: urlApi("/api/fotos"),
      headers: { Authorization: `Bearer ${token}`, "x-niko": "1" },
      clientPayload: JSON.stringify({ categoria }),
    });
    return resultado.url;
  } catch {
    // O Kyro continua funcionando localmente se o Blob ainda não estiver ligado
    // ao projeto ou se a rede cair durante a escolha da foto.
    return null;
  }
}

export async function removerFotoDoBlob(url: string | null | undefined): Promise<void> {
  if (!url || !/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//i.test(url)) return;
  const token = tokenDaSessao();
  if (!token) return;
  try {
    await fetch(`${urlApi("/api/fotos")}?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "x-niko": "1" },
    });
  } catch {
    return;
  }
}

interface OpcaoImagem {
  larguraMaxima: number;
  alturaMaxima: number;
  recortarQuadrado?: boolean;
  qualidade?: number;
}

export interface ImagemOtimizada {
  blob: Blob;
  dataUrl: string;
}

export async function otimizarImagem(arquivo: File, opcoes: OpcaoImagem): Promise<ImagemOtimizada> {
  if (!TIPOS_DE_IMAGEM.has(arquivo.type) || arquivo.size > LIMITE_DE_IMAGEM) throw new Error("imagem_invalida");
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = await new Promise<HTMLImageElement>((resolver, rejeitar) => {
      const elemento = new Image();
      elemento.onload = () => resolver(elemento);
      elemento.onerror = () => rejeitar(new Error("imagem_invalida"));
      elemento.src = url;
    });
    const recorte = Math.min(imagem.naturalWidth, imagem.naturalHeight);
    const larguraOriginal = opcoes.recortarQuadrado ? recorte : imagem.naturalWidth;
    const alturaOriginal = opcoes.recortarQuadrado ? recorte : imagem.naturalHeight;
    const escala = Math.min(1, opcoes.larguraMaxima / larguraOriginal, opcoes.alturaMaxima / alturaOriginal);
    const largura = Math.max(1, Math.round(larguraOriginal * escala));
    const altura = Math.max(1, Math.round(alturaOriginal * escala));
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("imagem_invalida");
    contexto.drawImage(
      imagem,
      opcoes.recortarQuadrado ? (imagem.naturalWidth - recorte) / 2 : 0,
      opcoes.recortarQuadrado ? (imagem.naturalHeight - recorte) / 2 : 0,
      larguraOriginal,
      alturaOriginal,
      0,
      0,
      largura,
      altura,
    );
    const qualidade = opcoes.qualidade ?? 0.86;
    const dataUrl = canvas.toDataURL("image/jpeg", qualidade);
    const blob = await new Promise<Blob>((resolver, rejeitar) => {
      canvas.toBlob((resultado) => (resultado ? resolver(resultado) : rejeitar(new Error("imagem_invalida"))), "image/jpeg", qualidade);
    });
    return { blob, dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

