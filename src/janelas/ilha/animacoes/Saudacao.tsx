import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { usarMovimentoReduzido } from "./usarMovimentoReduzido";
import { PersonagemKyro } from "../../../personagens/PersonagemKyro";
import { useConfig } from "../../../estado/configuracoes";
import { tocarSom } from "../../../ponte/sons";
import { liberarSistemaInicial } from "../../../desktop/desktop";
import { useInterface } from "../../../estado/interface";
import { temNovidadesDe } from "../../../utilitarios/novidades";
import { hojeISO, saudacao } from "../../../utilitarios/datas";
import { habitoCumprido, tarefasDoDia, useRotina } from "../../../estado/rotina";
import { T } from "../../../textos/textos";
import "./saudacao.css";

const INICIO_DO_TITULO = 0.15;
const INTERVALO_DAS_LETRAS = 0.03;
const SAIDA_MS = 4600;
const FIM_MS = 5350;

type Fase = "entrada" | "saida";

function resumoDeHoje(): { tarefas: number; habitos: number } {
  const { tarefas, habitos, registros } = useRotina.getState();
  const hoje = hojeISO();
  const pendentes = tarefasDoDia(tarefas, hoje).filter((t) => t.status !== "concluida" && t.status !== "cancelada").length;
  const habitosPendentes = habitos.filter((h) => !h.arquivado && !habitoCumprido(h, registros[hoje]?.[h.id])).length;
  return { tarefas: pendentes, habitos: habitosPendentes };
}

export function Saudacao({ versaoNova, aoTerminar }: { versaoNova?: string; aoTerminar: () => void }) {
  const nome = useConfig((s) => s.nome.trim().split(/\s+/)[0] ?? "");
  const reduzido = usarMovimentoReduzido();
  const [fase, setFase] = useState<Fase>("entrada");
  const [titulo] = useState(() => T.ilha.saudacao.titulo(saudacao(), nome));
  const [subtitulo] = useState(() => (versaoNova ? T.ilha.saudacao.atualizado(versaoNova) : T.ilha.saudacao.hoje(resumoDeHoje())));
  const saindo = fase === "saida";
  const sair = useRef<() => void>(() => undefined);

  useEffect(() => {
    const silenciosa = useConfig.getState().naoPerturbe;
    let encerrando = false;
    const relogios: number[] = [];
    const encerrar = () => {
      if (encerrando) return;
      encerrando = true;
      relogios.forEach((t) => window.clearTimeout(t));
      setFase("saida");
      void liberarSistemaInicial();
      if (versaoNova && temNovidadesDe(versaoNova)) useInterface.getState().irPara("atualizacao", { secao: "novidades" });
      relogios.push(window.setTimeout(aoTerminar, FIM_MS - SAIDA_MS));
    };
    sair.current = encerrar;
    if (!silenciosa) {
      relogios.push(window.setTimeout(() => void tocarSom("greet", "personagens"), INICIO_DO_TITULO * 1000));
    }
    relogios.push(window.setTimeout(encerrar, SAIDA_MS));
    return () => relogios.forEach((t) => window.clearTimeout(t));
  }, [aoTerminar, versaoNova]);

  return (
    <motion.div
      className="saudacao"
      role="button"
      tabIndex={0}
      aria-label={`${titulo}. ${subtitulo}. ${T.ilha.saudacao.pular}`}
      title={T.ilha.saudacao.pular}
      onClick={() => sair.current()}
      onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter" || e.key === " ") && sair.current()}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <div className="saudacao-personagem" aria-hidden="true">
        <PersonagemKyro tamanho={56} />
      </div>
      <h2 className="saudacao-titulo" aria-hidden="true">
        {Array.from(titulo).map((letra, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: reduzido ? 0 : 9, filter: reduzido ? "blur(0px)" : "blur(8px)" }}
            animate={
              saindo
                ? { opacity: 0, y: -6, filter: "blur(6px)", transition: { delay: i * 0.008, duration: 0.28 } }
                : { opacity: 1, y: 0, filter: "blur(0px)", transition: { delay: INICIO_DO_TITULO + i * INTERVALO_DAS_LETRAS, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] } }
            }
          >
            {letra === " " ? " " : letra}
          </motion.span>
        ))}
      </h2>
      <motion.p
        className="saudacao-subtitulo"
        aria-hidden="true"
        initial={{ opacity: 0, y: 6 }}
        animate={saindo ? { opacity: 0, transition: { duration: 0.2 } } : { opacity: 1, y: 0, transition: { delay: INICIO_DO_TITULO + titulo.length * INTERVALO_DAS_LETRAS + 0.15, duration: 0.5 } }}
      >
        {subtitulo}
      </motion.p>
    </motion.div>
  );
}
