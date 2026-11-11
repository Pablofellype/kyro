import "./carregamento.css";

export function CarregamentoKyro({ mensagem = "Preparando seu espaço" }: { mensagem?: string }) {
  return (
    <div className="kyro-boot" aria-busy="true" aria-label="Carregando Kyro">
      <header className="kyro-boot-topo"><div className="kyro-boot-marca"><img src="/apple-touch-icon.png" alt="" width="36" height="36" /><span>kyro<b>.</b></span></div><span className="kyro-boot-assinatura">Seu mundo, bem organizado.</span></header>
      <div className="kyro-boot-centro">
        <div className="kyro-boot-cena" aria-hidden="true"><div className="kyro-boot-placa kyro-boot-placa-atras" /><div className="kyro-boot-placa kyro-boot-placa-frente"><div className="kyro-boot-placa-barra"><i /><i /><i /><span /></div><div className="kyro-boot-miniapp"><img src="/apple-touch-icon.png" alt="" width="26" height="26" /><span /><span /></div></div><div className="kyro-boot-ilha"><b>k.</b><i /><i /><i /></div></div>
        <span className="kyro-boot-kicker">PESSOAL. EMPRESA. CONECTADOS.</span>
        <h1 className="kyro-boot-titulo">Seu espaço está chegando<span>.</span></h1>
        <p className="kyro-boot-descricao">Tudo o que move o seu dia, no mesmo lugar.</p>
        <div className="kyro-boot-progresso" role="progressbar" aria-label={mensagem}><span /></div>
        <div className="kyro-boot-status" role="status"><i aria-hidden="true" /><span>{mensagem}</span></div>
      </div>
      <footer className="kyro-boot-rodape"><span>Mais espaço para o que importa.</span><span>KYRO / BR</span></footer>
    </div>
  );
}
