export type FrequenciaAderencia = "manual" | "diaria" | "semanal";

export interface PlanilhaAderencia {
  id: string;
  nome: string;
  sheetUrl: string;
  tabUrl: string;
  colStart: string;
  colEnd: string;
  rowStart: number;
  rowEnd: number;
  headerLinha: number | null;
  soPrint: boolean;
  redThreshold: number;
  yellowEnabled: boolean;
  yellowThreshold: number;
}

export interface ResultadoAderencia {
  executadoEm: string;
  planilhasEnviadas: number;
  alertas: number;
  urgentes: number;
  erros: string[];
}

export interface GrupoAderencia {
  id: string;
  nome: string;
  ativo: boolean;
  frequencia: FrequenciaAderencia;
  hora: string;
  diasSemana: number[];
  planilhas: PlanilhaAderencia[];
  ultimoAgendamento: string;
  ultimoResultado: ResultadoAderencia | null;
}

export interface ConfiguracaoAderencias {
  ativo: boolean;
  destinoJid: string;
  destinoNome: string;
  frequencia: FrequenciaAderencia;
  hora: string;
  diasSemana: number[];
  planilhas: PlanilhaAderencia[];
  ultimoAgendamento: string;
  ultimoResultado: ResultadoAderencia | null;
  grupos: GrupoAderencia[];
}

export const PLANILHA_ADERENCIA_PADRAO: PlanilhaAderencia = {
  id: "",
  nome: "",
  sheetUrl: "",
  tabUrl: "",
  colStart: "A",
  colEnd: "C",
  rowStart: 1,
  rowEnd: 30,
  headerLinha: null,
  soPrint: false,
  redThreshold: 2,
  yellowEnabled: true,
  yellowThreshold: 1,
};

export const CONFIGURACAO_ADERENCIAS_PADRAO: ConfiguracaoAderencias = {
  ativo: false,
  destinoJid: "",
  destinoNome: "",
  frequencia: "manual",
  hora: "08:00",
  diasSemana: [1, 2, 3, 4, 5],
  planilhas: [],
  ultimoAgendamento: "",
  ultimoResultado: null,
  grupos: [],
};

function texto(valor: unknown, reserva: string, limite: number): string {
  return typeof valor === "string" && valor.trim() ? valor.trim().slice(0, limite) : reserva;
}

function inteiro(valor: unknown, reserva: number, minimo: number, maximo: number): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isInteger(n) ? Math.max(minimo, Math.min(maximo, n)) : reserva;
}

export function planilhaAderenciaValida(valor: unknown, idReserva = ""): PlanilhaAderencia {
  const bruto = valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Partial<PlanilhaAderencia> : {};
  return {
    id: texto(bruto.id, idReserva, 80),
    nome: texto(bruto.nome, "Planilha sem nome", 100),
    sheetUrl: texto(bruto.sheetUrl, "", 500),
    tabUrl: texto(bruto.tabUrl, "", 500),
    colStart: texto(bruto.colStart, "A", 4).toUpperCase(),
    colEnd: texto(bruto.colEnd, "C", 4).toUpperCase(),
    rowStart: inteiro(bruto.rowStart, 1, 1, 10000),
    rowEnd: inteiro(bruto.rowEnd, 30, 1, 10000),
    headerLinha: bruto.headerLinha === null || bruto.headerLinha === undefined || String(bruto.headerLinha) === "" ? null : inteiro(bruto.headerLinha, 1, 1, 10000),
    soPrint: bruto.soPrint === true,
    redThreshold: inteiro(bruto.redThreshold, 2, 1, 3650),
    yellowEnabled: bruto.yellowEnabled !== false,
    yellowThreshold: inteiro(bruto.yellowThreshold, 1, 1, 3650),
  };
}

function resultadoAderenciaValido(valor: unknown): ResultadoAderencia | null {
  if (!valor || typeof valor !== "object") return null;
  const bruto = valor as Partial<ResultadoAderencia>;
  return {
    executadoEm: texto(bruto.executadoEm, "", 80),
    planilhasEnviadas: inteiro(bruto.planilhasEnviadas, 0, 0, 30),
    alertas: inteiro(bruto.alertas, 0, 0, 10000),
    urgentes: inteiro(bruto.urgentes, 0, 0, 10000),
    erros: Array.isArray(bruto.erros) ? bruto.erros.filter((e): e is string => typeof e === "string").slice(0, 30) : [],
  };
}

export function grupoAderenciaValido(valor: unknown, idReserva = "grupo-1"): GrupoAderencia {
  const bruto = valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Partial<GrupoAderencia> : {};
  const planilhas = Array.isArray(bruto.planilhas)
    ? bruto.planilhas.slice(0, 30).map((p, i) => planilhaAderenciaValida(p, `planilha-${i + 1}`)).filter((p) => p.sheetUrl || p.nome !== "Planilha sem nome")
    : [];
  return {
    id: texto(bruto.id, idReserva, 80),
    nome: texto(bruto.nome, "Nova rotina", 100),
    ativo: bruto.ativo === true,
    frequencia: bruto.frequencia === "diaria" || bruto.frequencia === "semanal" ? bruto.frequencia : "manual",
    hora: /^\d{2}:\d{2}$/.test(String(bruto.hora ?? "")) ? String(bruto.hora) : "08:00",
    diasSemana: Array.isArray(bruto.diasSemana) ? bruto.diasSemana.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 7) : [1, 2, 3, 4, 5],
    planilhas,
    ultimoAgendamento: texto(bruto.ultimoAgendamento, "", 80),
    ultimoResultado: resultadoAderenciaValido(bruto.ultimoResultado),
  };
}

export function configuracaoAderenciasValida(valor: unknown): ConfiguracaoAderencias {
  const bruto = valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Partial<ConfiguracaoAderencias> : {};
  const planilhasLegadas = Array.isArray(bruto.planilhas)
    ? bruto.planilhas.slice(0, 30).map((p, i) => planilhaAderenciaValida(p, `planilha-${i + 1}`)).filter((p) => p.sheetUrl || p.nome !== "Planilha sem nome")
    : [];
  const possuiGrupos = Array.isArray(bruto.grupos);
  const grupos = possuiGrupos
    ? bruto.grupos!.slice(0, 30).map((g, i) => grupoAderenciaValido(g, `grupo-${i + 1}`))
    : Object.keys(bruto).length > 0
      ? [grupoAderenciaValido({
        id: "grupo-1",
        nome: "Rotina principal",
        ativo: bruto.ativo,
        frequencia: bruto.frequencia,
        hora: bruto.hora,
        diasSemana: bruto.diasSemana,
        planilhas: planilhasLegadas,
        ultimoAgendamento: bruto.ultimoAgendamento,
        ultimoResultado: bruto.ultimoResultado,
      }, "grupo-1")]
      : [];
  const primeiroGrupo = grupos[0];
  return {
    ativo: primeiroGrupo?.ativo ?? bruto.ativo === true,
    destinoJid: texto(bruto.destinoJid, "", 160),
    destinoNome: texto(bruto.destinoNome, "", 120),
    frequencia: primeiroGrupo?.frequencia ?? (bruto.frequencia === "diaria" || bruto.frequencia === "semanal" ? bruto.frequencia : "manual"),
    hora: primeiroGrupo?.hora ?? (/^\d{2}:\d{2}$/.test(String(bruto.hora ?? "")) ? String(bruto.hora) : "08:00"),
    diasSemana: primeiroGrupo?.diasSemana ?? (Array.isArray(bruto.diasSemana) ? bruto.diasSemana.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 7) : [1, 2, 3, 4, 5]),
    planilhas: primeiroGrupo?.planilhas ?? planilhasLegadas,
    ultimoAgendamento: primeiroGrupo?.ultimoAgendamento ?? texto(bruto.ultimoAgendamento, "", 80),
    ultimoResultado: primeiroGrupo?.ultimoResultado ?? resultadoAderenciaValido(bruto.ultimoResultado),
    grupos,
  };
}
