import type { UsuarioAutenticado } from "../../estado/autenticacao.ts";

export const STATUS_APLICATIVO = {
  disponivel: "Disponível",
  manutencao: "Em manutenção",
  prototipo: "Protótipo",
} as const;
export type StatusAplicativo = keyof typeof STATUS_APLICATIVO;

export const TIPOS_PROPOSTA = {
  pdf: { rotulo: "PDF da proposta", extensao: "pdf", mime: "application/pdf", limiteMb: 15 },
  video: { rotulo: "Vídeo de apresentação", extensao: "mp4", mime: "video/mp4", limiteMb: 100 },
} as const;
export type TipoProposta = keyof typeof TIPOS_PROPOSTA;
export const TIPOS_DE_ANEXO = ["pdf", "video"] as const;
export type AnexoProposta = { origem: "link"; url: string } | { origem: "arquivo"; nome: string; caminho: string };
export type PropostaAplicativo = Partial<Record<TipoProposta, AnexoProposta>>;

export interface AplicativoEmpresa {
  id: string;
  nome: string;
  descricao: string;
  url: string | null;
  status: StatusAplicativo;
  publico: boolean;
  proposta?: PropostaAplicativo;
}

// Catálogo compartilhado pelos acessos da empresa e pelo portal público.
export const APLICATIVOS_EMPRESA: AplicativoEmpresa[] = [
  {
    id: "registros-limpeza",
    nome: "Registros de limpeza",
    descricao: "Consulte e acompanhe os registros de limpeza.",
    url: "https://registros-limpeza.brasalrefrigerantes.com.br/",
    status: "disponivel",
    publico: true,
  },
  {
    id: "calendario-limpeza",
    nome: "Calendário Limpeza",
    descricao: "Acompanhe a programação das limpezas.",
    url: "https://calendario-dpa.vercel.app/",
    status: "disponivel",
    publico: true,
  },
  {
    id: "materiais",
    nome: "Solicitação de material",
    descricao: "Acesse as solicitações de materiais da empresa.",
    url: "https://inventario-internoo.vercel.app/",
    status: "disponivel",
    publico: true,
  },
  {
    id: "requisicoes",
    nome: "Sistema de requisições",
    descricao: "Gerencie e acompanhe as requisições.",
    url: "https://sistema-requisicoes.vercel.app/",
    status: "disponivel",
    publico: true,
  },
  {
    id: "nps",
    nome: "Avaliação NPS",
    descricao: "Acompanhe as avaliações de satisfação.",
    url: "https://avalia-ai-seven.vercel.app/",
    status: "disponivel",
    publico: true,
  },
  {
    id: "armarios",
    nome: "Armários geral",
    descricao: "Sistema de armários em manutenção.",
    url: null,
    status: "manutencao",
    publico: true,
  },
];

export interface ItemMenuAplicativoEmpresa {
  id: string;
  nome: string;
  disponivel: boolean;
  status?: StatusAplicativo;
}

export function temProposta(app: AplicativoEmpresa): boolean {
  return Boolean(app.proposta?.pdf || app.proposta?.video);
}

export function abreAplicativo(app: AplicativoEmpresa): boolean {
  return app.status === "disponivel" && Boolean(app.url);
}

export const GERENCIAR_APLICATIVOS = "gerenciar-aplicativos";
export const ORIGENS_DE_APPS_INCORPORADOS = new Set(APLICATIVOS_EMPRESA.flatMap((app) => app.url ? [new URL(app.url).origin] : []));

export function itensDoMenuAppsEmpresa(
  usuario: Pick<UsuarioAutenticado, "perfil" | "roboAderencias"> | null,
  catalogo = APLICATIVOS_EMPRESA,
): ItemMenuAplicativoEmpresa[] {
  const podeAderencias = usuario?.perfil === "dono" || (usuario?.perfil === "gerencia" && usuario.roboAderencias === true);
  const podeVerPropostas = usuario?.perfil === "dono" || usuario?.perfil === "gerencia";
  return [
    ...(podeAderencias ? [{ id: "aderencias", nome: "Robô de Aderências", disponivel: true }] : []),
    ...catalogo.map((app) => ({
      id: app.id, nome: app.nome, status: app.status,
      disponivel: abreAplicativo(app) || (podeVerPropostas && (app.status === "prototipo" || temProposta(app))),
    })),
  ];
}
