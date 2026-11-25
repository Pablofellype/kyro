import { UserRound, Users } from "lucide-react";
import { CaixaDeEscolha, type OpcaoDeEscolha } from "../../componentes/CaixaDeEscolha";
import { normalizarTexto } from "../../utilitarios/basicos";

interface ConversaSelecionavel {
  id: string;
  nome: string;
  grupo: boolean;
}

export function SeletorConversaWhatsapp({ id, valor, conversas, somenteGrupos, desativado, carregando, aoMudar }: {
  id: string;
  valor: string;
  conversas: ConversaSelecionavel[];
  somenteGrupos?: boolean;
  desativado?: boolean;
  carregando?: boolean;
  aoMudar: (valor: string) => void;
}) {
  const nomes = new Map<string, number>();
  for (const { nome } of conversas) {
    const chave = normalizarTexto(nome);
    nomes.set(chave, (nomes.get(chave) ?? 0) + 1);
  }
  const opcoes: OpcaoDeEscolha[] = conversas.map(({ id, nome, grupo }) => ({
    valor: id,
    rotulo: nome,
    icone: grupo ? <Users size={15} aria-hidden="true" /> : <UserRound size={15} aria-hidden="true" />,
    descricao: (nomes.get(normalizarTexto(nome)) ?? 0) > 1 ? `…${id.split("@")[0].slice(-8)}` : undefined,
  }));
  if (!somenteGrupos && valor) opcoes.unshift({ valor: "", rotulo: "Sem destino" });

  return <CaixaDeEscolha
    id={id}
    valor={valor}
    opcoes={opcoes}
    aoMudar={aoMudar}
    desativada={desativado}
    placeholder={carregando ? "Carregando grupos…" : somenteGrupos ? "Escolha um grupo" : "Selecione um contato ou grupo"}
    textoDaBusca={somenteGrupos ? "Buscar grupo pelo nome" : "Buscar grupo ou contato pelo nome"}
    textoSemResultado={somenteGrupos ? "Nenhum grupo encontrado." : "Nenhum grupo ou contato encontrado."}
  />;
}
