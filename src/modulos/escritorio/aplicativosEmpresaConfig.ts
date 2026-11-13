import type { UsuarioAutenticado } from "../../estado/autenticacao";

export interface AplicativoEmpresa {
  id: string;
  nome: string;
  descricao: string;
  url: string | null;
  status: "disponivel" | "manutencao";
  publico: boolean;
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
    url: "https://inventario-internoo.vercel.app/manutencao.html",
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
}

export function itensDoMenuAppsEmpresa(usuario: Pick<UsuarioAutenticado, "perfil" | "roboAderencias"> | null): ItemMenuAplicativoEmpresa[] {
  const podeAderencias = usuario?.perfil === "dono" || (usuario?.perfil === "gerencia" && usuario.roboAderencias === true);
  return [
    ...(podeAderencias ? [{ id: "aderencias", nome: "Robô de Aderências", disponivel: true }] : []),
    ...APLICATIVOS_EMPRESA.map((app) => ({ id: app.id, nome: app.nome, disponivel: app.status === "disponivel" && !!app.url })),
    { id: "solicitacoes", nome: "Solicitações recebidas", disponivel: true },
  ];
}
