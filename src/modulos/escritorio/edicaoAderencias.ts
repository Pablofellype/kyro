import { CONFIGURACAO_ADERENCIAS_PADRAO, configuracaoAderenciasValida, grupoAderenciaValido, type ConfiguracaoAderencias, type GrupoAderencia, type PlanilhaAderencia } from "./aderenciasTipos.ts";

export interface RascunhoAderencias {
  grupo: GrupoAderencia;
  novo: boolean;
  excluir: boolean;
  destinoJid: string;
  destinoNome: string;
  destinoInicial: string;
}

function novoId() {
  return globalThis.crypto?.randomUUID?.() ?? `aderencia-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function copiarPlanilhasAderencias(planilhas: PlanilhaAderencia[]): PlanilhaAderencia[] {
  return planilhas.map((planilha) => ({ ...planilha, id: novoId() }));
}

export function criarRascunhoAderencias(config: ConfiguracaoAderencias, grupo?: GrupoAderencia, duplicar = false): RascunhoAderencias {
  const copia = grupo ? structuredClone(grupo) : grupoAderenciaValido({ id: novoId(), nome: `Rotina ${config.grupos.length + 1}` });
  if (duplicar) {
    copia.id = novoId();
    copia.nome = `${copia.nome} (cópia)`.slice(0, 100);
    copia.ativo = false;
    copia.ultimoAgendamento = "";
    copia.ultimoResultado = null;
    copia.planilhas = copiarPlanilhasAderencias(copia.planilhas);
  }
  return { grupo: copia, novo: !grupo || duplicar, excluir: false, destinoJid: config.destinoJid, destinoNome: config.destinoNome, destinoInicial: config.destinoJid };
}

// Aplica somente a rotina editada à configuração mais recente. Resultados e
// marcadores do agendador não pertencem ao formulário e precisam ser preservados.
export function aplicarRascunhoAderencias(config: ConfiguracaoAderencias, rascunho: RascunhoAderencias): ConfiguracaoAderencias {
  const existente = config.grupos.find((grupo) => grupo.id === rascunho.grupo.id);
  if (!rascunho.novo && !existente) throw new Error("Esta rotina não existe mais. Volte ao painel e atualize as rotinas.");
  if (rascunho.excluir) {
    const grupos = config.grupos.filter((grupo) => grupo.id !== rascunho.grupo.id);
    // Sem rotinas, limpa também o espelho legado lido pelo worker. Caso
    // contrário, a última rotina removida continuaria disponível nesse espelho.
    return configuracaoAderenciasValida({ ...(grupos.length ? config : CONFIGURACAO_ADERENCIAS_PADRAO), destinoJid: config.destinoJid, destinoNome: config.destinoNome, grupos });
  }
  if (!rascunho.grupo.nome.trim()) throw new Error("Informe o nome da rotina.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rascunho.grupo.hora)) throw new Error("Informe um horário válido.");
  if (rascunho.grupo.frequencia === "semanal" && !rascunho.grupo.diasSemana.length) throw new Error("Escolha pelo menos um dia da semana.");
  if (rascunho.grupo.planilhas.length > 30) throw new Error("Cada rotina pode ter até 30 planilhas.");
  if (rascunho.novo && config.grupos.length >= 30) throw new Error("Você já tem 30 rotinas. Exclua uma antes de criar outra.");
  const grupo = grupoAderenciaValido({ ...rascunho.grupo, ultimoAgendamento: existente?.ultimoAgendamento ?? "", ultimoResultado: existente?.ultimoResultado ?? null });
  return configuracaoAderenciasValida({
    ...config,
    destinoJid: rascunho.destinoJid !== rascunho.destinoInicial ? rascunho.destinoJid : config.destinoJid,
    destinoNome: rascunho.destinoJid !== rascunho.destinoInicial ? rascunho.destinoNome : config.destinoNome,
    grupos: rascunho.novo ? [...config.grupos, grupo] : config.grupos.map((atual) => atual.id === grupo.id ? grupo : atual),
  });
}
