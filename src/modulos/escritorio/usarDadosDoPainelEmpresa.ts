import { useEffect, useState } from "react";
import { useAuth } from "../../estado/autenticacao";
import { carregarDadosDoPainel, DADOS_REMOTOS_VAZIOS, type DadosRemotosDoPainel } from "./dadosDoPainelEmpresa";

export function usarDadosDoPainelEmpresa(ativo: boolean) {
  const token = useAuth((estado) => estado.token);
  const usuario = useAuth((estado) => estado.usuario);
  const [versao, setVersao] = useState(0);
  const [estado, setEstado] = useState<{ chave: string; dados: DadosRemotosDoPainel; carregando: boolean; atualizadoEm: Date | null }>({ chave: "", dados: DADOS_REMOTOS_VAZIOS, carregando: true, atualizadoEm: null });
  const chave = `${usuario?.id ?? ""}:${usuario?.perfil ?? ""}:${token ?? ""}`;

  useEffect(() => {
    if (!ativo || !token || !usuario || usuario.perfil === "visitante") return;
    let vivo = true;
    const controle = new AbortController();
    const prazo = window.setTimeout(() => controle.abort(), 12000);
    setEstado((anterior) => ({ chave, dados: anterior.chave === chave ? anterior.dados : DADOS_REMOTOS_VAZIOS, carregando: true, atualizadoEm: anterior.chave === chave ? anterior.atualizadoEm : null }));
    void carregarDadosDoPainel(usuario.perfil, token, controle.signal).then((dados) => {
      const atual = useAuth.getState();
      if (!vivo || atual.token !== token || atual.usuario?.id !== usuario.id || atual.usuario.perfil !== usuario.perfil) return;
      setEstado({ chave, dados, carregando: false, atualizadoEm: new Date() });
    }).finally(() => window.clearTimeout(prazo));
    return () => { vivo = false; controle.abort(); window.clearTimeout(prazo); };
  }, [ativo, chave, versao, token, usuario?.id, usuario?.perfil]);

  useEffect(() => {
    if (!ativo) return;
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") setVersao((valor) => valor + 1);
    }, 60000);
    return () => window.clearInterval(intervalo);
  }, [ativo]);

  const atual = ativo && estado.chave === chave && Boolean(token) ? estado : { dados: DADOS_REMOTOS_VAZIOS, carregando: ativo && Boolean(token), atualizadoEm: null };
  return { ...atual.dados, carregando: atual.carregando, atualizadoEm: atual.atualizadoEm, atualizar: () => setVersao((valor) => valor + 1) };
}
