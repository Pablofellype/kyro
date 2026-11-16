export interface ConversaTeams {
  id: string;
  titulo: string;
  tipo: string;
  atualizadaEm: string | null;
  link: string | null;
  erro: string | null;
}

export interface MensagemTeams {
  id: string;
  conversaId: string;
  conversa: string;
  autor: string;
  texto: string;
  data: string;
  link: string | null;
  mencionaMe: boolean;
  importante: boolean;
  minha: boolean;
}

export interface DadosTeams {
  conta: string;
  conversas: ConversaTeams[];
  mensagens: MensagemTeams[];
  parcial: boolean;
}

export interface TarefaPlanner {
  id: string;
  titulo: string;
  plano: string;
  planoId: string;
  progresso: number;
  prioridade: number;
  prazo: string | null;
  criadaEm: string;
  link: string;
}

export interface DadosPlanner {
  conta: string;
  tarefas: TarefaPlanner[];
  parcial: boolean;
  planosIndisponiveis: number;
}
