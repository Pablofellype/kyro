import { useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { Ilha } from "../ilha/Ilha";
import { Dock } from "../dock/Dock";
import { AssistiveTouch } from "../assistive/AssistiveTouch";
import { JanelaSistema } from "../sistema/JanelaSistema";
import { JanelaConexao } from "../../modulos/conexoes/JanelaConexao";
import { BuscaGlobal } from "../../modulos/busca/BuscaGlobal";
import { CapturaRapida } from "../../modulos/busca/CapturaRapida";
import { PrimeiraExecucao } from "../../modulos/configuracoes/PrimeiraExecucao";
import { useInterface } from "../../estado/interface";
import { useConfig } from "../../estado/configuracoes";
import { usarTema } from "./usarTema";
import { usarAtalhos } from "./usarAtalhos";
import { useServicos } from "../../servicos/servicos";
import { usarTamanhoDaTela, verificarSeEhMobile } from "../usarTamanhoDaTela";

export function AreaDeTrabalho() {
  usarTema();
  usarAtalhos();
  useServicos();
  const tela = usarTamanhoDaTela();
  const ehMobile = verificarSeEhMobile(tela);
  const aberto = useInterface((s) => s.sistemaAberto);
  const minimizado = useInterface((s) => s.sistemaMinimizado);
  const janelas = useInterface((s) => s.janelasConexao);
  const primeira = useConfig((s) => s.primeiraExecucaoFeita);

  useEffect(() => {
    if (ehMobile) {
      document.documentElement.setAttribute("data-mobile", "sim");
    } else {
      document.documentElement.removeAttribute("data-mobile");
    }
  }, [ehMobile]);

  const sistemaVisivel = ehMobile || (aberto && !minimizado);

  return (
    <div className="area-trabalho" data-mobile={ehMobile ? "sim" : "nao"}>
      <AnimatePresence>{sistemaVisivel && <JanelaSistema key="sistema" />}</AnimatePresence>
      <AnimatePresence>
        {!ehMobile && janelas.filter((j) => !j.minimizada).map((j) => (
          <JanelaConexao key={j.id} janela={j} />
        ))}
      </AnimatePresence>
      <Ilha />
      {!ehMobile && <Dock />}
      {!ehMobile && <AssistiveTouch />}
      <BuscaGlobal />
      <CapturaRapida />
      {!primeira && <PrimeiraExecucao />}
    </div>
  );
}
