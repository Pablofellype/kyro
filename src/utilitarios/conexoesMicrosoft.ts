import type { TarefaPlanner } from "../tiposMicrosoft.ts";

export function clienteMicrosoftValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(valor);
}

export function tarefaPlannerAtrasada(tarefa: TarefaPlanner, agora = new Date()): boolean {
  return tarefa.progresso < 100 && Boolean(tarefa.prazo && Date.parse(tarefa.prazo) < agora.getTime());
}
