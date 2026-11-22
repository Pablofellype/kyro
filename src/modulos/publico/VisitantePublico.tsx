import { ArrowLeft, ArrowUpRight, CalendarDays, ClipboardCheck, ClipboardList, Globe2, LockKeyhole, PackageOpen, Smile, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoNiko } from "../../componentes/LogoNiko";
import { NATIVO } from "../../desktop/desktop";
import { APLICATIVOS_EMPRESA, type AplicativoEmpresa } from "../escritorio/aplicativosEmpresaConfig";
import { consultarAppsEmpresa } from "../escritorio/catalogoAppsEmpresa";
import "./visitantePublico.css";

const ICONES: Record<string, LucideIcon> = {
  "registros-limpeza": ClipboardCheck,
  "calendario-limpeza": CalendarDays,
  materiais: PackageOpen,
  requisicoes: ClipboardList,
  nps: Smile,
  armarios: LockKeyhole,
};

function CartaoDoSistema({ app }: { app: AplicativoEmpresa }) {
  const Icone = ICONES[app.id] ?? Globe2;
  const disponivel = app.status === "disponivel" && Boolean(app.url);
  const conteudo = (
    <>
      <div className="visitante-app-topo">
        <span className="visitante-app-icone" aria-hidden="true"><Icone size={23} /></span>
        <span className="visitante-app-estado" data-disponivel={disponivel ? "sim" : "nao"}>
          <i aria-hidden="true" />{disponivel ? "Disponível" : "Em manutenção"}
        </span>
      </div>
      <div className="visitante-app-texto">
        <h3>{app.nome}</h3>
        <p>{app.descricao}</p>
      </div>
      <span className="visitante-app-acao">
        {disponivel ? <>Acessar sistema <ArrowUpRight size={18} aria-hidden="true" /></> : <><LockKeyhole size={15} aria-hidden="true" /> Temporariamente indisponível</>}
      </span>
    </>
  );

  if (!disponivel) return <article className="visitante-app visitante-app-indisponivel" data-sistema={app.id} aria-label={`${app.nome}: em manutenção`}>{conteudo}</article>;
  return (
    <a className="visitante-app" data-sistema={app.id} href={app.url!} target="_blank" rel="noopener noreferrer" aria-label={`Acessar ${app.nome} (${NATIVO ? "abre no navegador" : "abre em outra aba"})`}>
      {conteudo}
    </a>
  );
}

export default function VisitantePublico() {
  const [catalogo, setCatalogo] = useState<AplicativoEmpresa[] | null>(() => typeof window === "undefined" ? APLICATIVOS_EMPRESA : null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    const controle = new AbortController();
    void consultarAppsEmpresa<{ aplicativos: AplicativoEmpresa[] }>("catalogo", null, undefined, controle.signal)
      .then(({ aplicativos }) => { if (!controle.signal.aborted) setCatalogo(aplicativos); })
      .catch(() => { if (!controle.signal.aborted) setErro(true); });
    return () => controle.abort();
  }, []);
  const aplicativos = catalogo?.filter((app) => app.publico);
  const disponiveis = aplicativos?.filter((app) => app.status === "disponivel" && app.url).length;

  return (
    <main className="visitante-publico">
      <header className="visitante-cabecalho">
        <div className="visitante-cabecalho-conteudo">
          <div className="visitante-marca">
            <LogoNiko tamanho={36} brilho={false} />
            <span><strong>kyro<span className="visitante-marca-ponto">.</span></strong><small>Portal da empresa</small></span>
          </div>
          <a href="/" className="visitante-voltar"><ArrowLeft size={17} aria-hidden="true" /><span>Voltar ao login</span></a>
        </div>
      </header>

      <div className="visitante-conteudo">
        <section className="visitante-introducao" aria-labelledby="visitante-titulo">
          <span className="visitante-etiqueta"><Globe2 size={14} aria-hidden="true" /> Acesso visitante</span>
          <h1 id="visitante-titulo">Qual sistema você quer acessar?</h1>
          <p>Escolha abaixo e vá direto ao que precisa. Você não precisa de uma conta no Kyro para continuar.</p>
        </section>

        <section className="visitante-sistemas" aria-labelledby="visitante-sistemas-titulo">
          <div className="visitante-sistemas-cabecalho">
            <h2 id="visitante-sistemas-titulo">Sistemas da empresa</h2>
            {disponiveis !== undefined && <span>{disponiveis} {disponiveis === 1 ? "disponível" : "disponíveis"}</span>}
          </div>
          {!aplicativos && <p role="status">{erro ? "Não foi possível carregar os aplicativos. Recarregue a página para tentar novamente." : "Carregando aplicativos…"}</p>}
          <div className="visitante-apps">
            {aplicativos?.map((app) => <CartaoDoSistema app={app} key={app.id} />)}
          </div>
          <p className="visitante-dica"><ArrowUpRight size={15} aria-hidden="true" />{NATIVO ? "Os sistemas abrem no navegador. Você pode voltar a este portal quando precisar." : "Os sistemas abrem em outra aba. Este portal continua disponível para você voltar."}</p>
        </section>

        <footer className="visitante-rodape">
          <span>Kyro · Portal da empresa</span>
          <a href="/">Já tem uma conta? <strong>Entrar no Kyro <ArrowUpRight size={14} aria-hidden="true" /></strong></a>
        </footer>
      </div>
    </main>
  );
}
