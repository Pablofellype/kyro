import { addDays } from "date-fns";
import type { Evento, Tarefa } from "../../tipos";
import type { UsuarioAutenticado } from "../../estado/autenticacao";
import { cabecalhosNiko, urlApi } from "../../estado/autenticacao";
import { dataValida, paraISO } from "../../utilitarios/datas";
import { ocorrencias } from "../../utilitarios/itensDoCalendario";
import { tarefaPendente } from "../../estado/rotina";

export interface PedidoDoPainel {
  id: string;
  material: string;
  solicitante: string;
  quantidade: number;
  status: string;
  criadoEm: string;
}

export interface MembroDoPainel {
  id: number;
  nome: string;
  ativo: boolean;
  perfil: UsuarioAutenticado["perfil"];
  cargo: string;
  setor: string;
}

export interface DadosRemotosDoPainel {
  pedidos: PedidoDoPainel[] | null;
  membros: MembroDoPainel[] | null;
  erroPedidos: boolean;
  erroMembros: boolean;
}

export const DADOS_REMOTOS_VAZIOS: DadosRemotosDoPainel = { pedidos: null, membros: null, erroPedidos: false, erroMembros: false };

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export function validarPedidosDoPainel(valor: unknown): PedidoDoPainel[] {
  if (!Array.isArray(valor)) throw new Error("resposta_invalida");
  return valor.map((item) => {
    if (!objeto(item) || !/^[1-9]\d*$/.test(String(item.id)) || !texto(item.material_nome) || !texto(item.status) || !Number.isInteger(item.quantidade) || Number(item.quantidade) < 1 || !texto(item.criado_em) || !Number.isFinite(Date.parse(String(item.criado_em)))) throw new Error("resposta_invalida");
    return { id: String(item.id), material: texto(item.material_nome), solicitante: texto(item.solicitante) || texto(item.visitante_nome) || "Solicitante não informado", quantidade: Number(item.quantidade), status: texto(item.status), criadoEm: String(item.criado_em) };
  });
}

function validarMembros(valor: unknown): MembroDoPainel[] {
  if (!Array.isArray(valor)) throw new Error("resposta_invalida");
  return valor.map((item) => {
    if (!objeto(item) || !Number.isSafeInteger(item.id) || Number(item.id) < 1 || !texto(item.nome) || typeof item.ativo !== "boolean" || !["dono", "gerencia", "visitante"].includes(String(item.perfil))) throw new Error("resposta_invalida");
    return { id: Number(item.id), nome: texto(item.nome), ativo: item.ativo, perfil: item.perfil as MembroDoPainel["perfil"], cargo: texto(item.cargo), setor: texto(item.setor) };
  });
}

export async function carregarDadosDoPainel(perfil: UsuarioAutenticado["perfil"], token: string, sinal: AbortSignal, consultar: typeof fetch = fetch): Promise<DadosRemotosDoPainel> {
  if (!token || (perfil !== "dono" && perfil !== "gerencia")) return DADOS_REMOTOS_VAZIOS;
  const ler = async (caminho: string) => {
    const resposta = await consultar(urlApi(caminho), { headers: { ...cabecalhosNiko(), Authorization: `Bearer ${token}` }, signal: sinal, cache: "no-store" });
    if (!resposta.ok) throw new Error(`http_${resposta.status}`);
    const dados: unknown = await resposta.json();
    if (!objeto(dados)) throw new Error("resposta_invalida");
    return dados;
  };
  const [pedidos, membros] = await Promise.allSettled([
    ler("/api/solicitacoes").then((dados) => validarPedidosDoPainel(dados.solicitacoes)),
    perfil === "dono" ? ler("/api/auth?acao=usuarios").then((dados) => validarMembros(dados.usuarios)) : Promise.resolve(null),
  ]);
  return {
    pedidos: pedidos.status === "fulfilled" ? pedidos.value : null,
    membros: membros.status === "fulfilled" ? membros.value : null,
    erroPedidos: pedidos.status === "rejected",
    erroMembros: membros.status === "rejected",
  };
}

export interface CompromissoDoPainel {
  id: string;
  titulo: string;
  data: string;
  hora?: string;
  tipo: Evento["tipo"];
}

export type PrioridadeDoPainel = { tipo: "tarefa"; tarefa: Tarefa; atrasada: boolean } | { tipo: "pedido"; pedido: PedidoDoPainel };

export interface RegistroDoPainel {
  id: string;
  titulo: string;
  detalhe: string;
  data: string;
  tipo: "pedido" | "tarefa";
}

export function resumirPainelEmpresa(eventos: Evento[], tarefas: Tarefa[], pedidos: PedidoDoPainel[] | null, agora: Date) {
  const hoje = paraISO(agora);
  const horario = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const limiteAgenda = paraISO(addDays(agora, 30));
  const daEmpresa = tarefas.filter((tarefa) => tarefa.area === "empresa");
  const estaAtrasada = (tarefa: Tarefa) => Boolean(tarefa.data && (tarefa.data < hoje || (tarefa.data === hoje && tarefa.hora && tarefa.hora < horario)));
  const abertas = daEmpresa.filter(tarefaPendente).sort((a, b) => Number(estaAtrasada(b)) - Number(estaAtrasada(a)) || (a.data ?? "9999").localeCompare(b.data ?? "9999") || (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99") || Number(b.prioridade === "alta") - Number(a.prioridade === "alta") || a.ordem - b.ordem);
  const atrasadas = abertas.filter(estaAtrasada);
  const pedidosPendentes = pedidos?.filter((pedido) => pedido.status === "pendente").sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm)) ?? null;
  const agenda: CompromissoDoPainel[] = eventos.filter((evento) => evento.area === "empresa" && dataValida(evento.data)).flatMap((evento) => ocorrencias(evento, hoje, limiteAgenda)
    .filter((data) => !(evento.feitos ?? []).includes(data) && (data > hoje || !evento.hora || evento.hora >= horario))
    .map((data) => ({ id: `${evento.id}:${data}`, titulo: evento.titulo, data, hora: evento.hora, tipo: evento.tipo })))
    .sort((a, b) => a.data.localeCompare(b.data) || (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"));
  const prioridades: PrioridadeDoPainel[] = [
    ...atrasadas.map((tarefa) => ({ tipo: "tarefa" as const, tarefa, atrasada: true })),
    ...(pedidosPendentes ?? []).map((pedido) => ({ tipo: "pedido" as const, pedido })),
    ...abertas.filter((tarefa) => !estaAtrasada(tarefa)).map((tarefa) => ({ tipo: "tarefa" as const, tarefa, atrasada: false })),
  ];
  const historico: RegistroDoPainel[] = [
    ...(pedidos ?? []).map((pedido) => ({ id: `pedido-${pedido.id}`, tipo: "pedido" as const, titulo: `Solicitação recebida: ${pedido.material}`, detalhe: pedido.solicitante, data: pedido.criadoEm })),
    ...daEmpresa.filter((tarefa) => tarefa.status === "concluida" && tarefa.concluidaEm).map((tarefa) => ({ id: `tarefa-${tarefa.id}`, tipo: "tarefa" as const, titulo: `Atividade concluída: ${tarefa.titulo}`, detalhe: "Atividade da empresa", data: tarefa.concluidaEm! })),
  ].filter((registro) => Number.isFinite(Date.parse(registro.data)) && Date.parse(registro.data) <= agora.getTime()).sort((a, b) => Date.parse(b.data) - Date.parse(a.data)).slice(0, 5);
  return { hoje, limiteAgenda, abertas, atrasadas, paraHoje: abertas.filter((tarefa) => tarefa.data === hoje), pedidosPendentes, agenda, prioridades, historico };
}

export type ResumoDoPainelEmpresa = ReturnType<typeof resumirPainelEmpresa>;
