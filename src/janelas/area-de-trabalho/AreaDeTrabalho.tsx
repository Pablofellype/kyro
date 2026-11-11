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
import { useAuth } from "../../estado/autenticacao";
import { TelaLogin } from "../../componentes/login/TelaLogin";
import { CarregamentoKyro } from "../../componentes/login/CarregamentoKyro";

export function AreaDeTrabalho() {
  usarTema();
  usarAtalhos();
  useServicos();
  const tela = usarTamanhoDaTela();
  const ehMobile = verificarSeEhMobile(tela);
  const janelas = useInterface((s) => s.janelasConexao);
  const primeira = useConfig((s) => s.primeiraExecucaoFeita);

  const usuario = useAuth((s) => s.usuario);
  const carregandoAuth = useAuth((s) => s.carregando);
  const verificar = useAuth((s) => s.verificar);

  useEffect(() => {
    void verificar();
  }, [verificar]);

  useEffect(() => {
    if (ehMobile) {
      document.documentElement.setAttribute("data-mobile", "sim");
    } else {
      document.documentElement.removeAttribute("data-mobile");
    }
  }, [ehMobile]);

  if (carregandoAuth) {
    return <CarregamentoKyro mensagem="Confirmando seu acesso" />;
  }

  if (!usuario) {
    return <TelaLogin />;
  }

  const dono = usuario.perfil === "dono";

  return (
    <div className="area-trabalho area-web estilo-sistema" data-modelo={ehMobile ? "web-celular" : "web-computador"} data-mobile={ehMobile ? "sim" : "nao"}>
      <JanelaSistema mobile={ehMobile} />
      <AnimatePresence>
        {!ehMobile && janelas.filter((j) => !j.minimizada).map((j) => (
          <JanelaConexao key={j.id} janela={j} />
        ))}
      </AnimatePresence>
      <Ilha />
      {!ehMobile && <Dock />}
      {!ehMobile && <AssistiveTouch />}
      {dono && <BuscaGlobal />}
      {dono && <CapturaRapida />}
      {dono && !primeira && <PrimeiraExecucao />}
    </div>
  );
}
