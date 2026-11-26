import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sun, Moon, PanelLeftClose, PanelLeftOpen, Check, Settings, ChevronDown, LogOut, UserRound, Building2, LayoutDashboard, Menu, X } from "lucide-react";
import { useConfig, GRUPO_DA_ROTA, type ItemBarra } from "../../estado/configuracoes";
import { useInterface } from "../../estado/interface";
import { useRotina, tarefasDoDia } from "../../estado/rotina";
import { useEstudos, revisoesParaHoje } from "../../estado/estudos";
import { useAgentes } from "../../estado/agentes";
import { useOrganizacao } from "../../estado/organizacao";
import { useAuth } from "../../estado/autenticacao";
import { useWhatsapp } from "../../estado/whatsapp";
import { T } from "../../textos/textos";
import { ICONE_ROTA } from "./rotas";
import { LogoNiko } from "../../componentes/LogoNiko";
import { Avatar } from "../../componentes/FotoPerfil";
import { hojeISO } from "../../utilitarios/datas";
import type { AreaSistema, Rota } from "../../tipos";
import { funcaoLigada } from "../../utilitarios/funcoes";
import { itensVisiveisDaBarra, primeiraRotaDaArea, rotaDisponivelNaArea, ROTAS_NO_TOPO_EMPRESA, ROTULOS_EMPRESA, ROTULOS_PESSOAIS } from "./areas";
import { mudarTema } from "../area-de-trabalho/mudarTema";
import { IndicadorSincronia } from "../../componentes/IndicadorSincronia";
import { Marca } from "../../marcas/Marca";
import { ehDono, podeAcessarArea, podeAcessarRota, rotuloDoPapel } from "../../servicos/permissoes";
import { AppsEmpresaNoMenu } from "./AppsEmpresaNoMenu";
import { PlanilhasNoMenu, PowerBiNoMenu } from "./RelatoriosEPlanilhasNoMenu";
import "./barraLateral.css";
import { conexaoVisivelPara } from "../../utilitarios/visibilidadeConexoes";
import { useIlha } from "../../estado/ilha";
import { abasVisiveisDaIlha } from "../ilha/abasDaIlha";
import { usarResumoDoInventario } from "../../modulos/escritorio/notificacoesAppsEmpresa";
import { tocarSom } from "../../ponte/sons";

function useContadores(): Partial<Record<Rota, { n: number; alerta?: boolean }>> {
  const usuario = useAuth((s) => s.usuario);
  const hoje = hojeISO();
  const area = useInterface((s) => s.area);
  const tarefas = useRotina((s) => tarefasDoDia(s.tarefas.filter((t) => area === "empresa" ? t.area === "empresa" : t.area !== "empresa"), hoje).filter((t) => t.status !== "concluida" && t.status !== "cancelada").length);
  const revisoes = useEstudos((s) => revisoesParaHoje(s));
  const falhas = useAgentes((s) => s.alertas.filter((a) => a.servico && conexaoVisivelPara(usuario, a.servico)).length);
  const eventos = useOrganizacao((s) => s.eventos.filter((e) => e.data === hoje && (area === "empresa" ? e.area === "empresa" : e.area !== "empresa")).length);
  return {
    journal: { n: tarefas },
    estudos: { n: revisoes },
    conexoes: { n: falhas, alerta: true },
    calendario: { n: eventos },
  };
}

interface Caixa {
  l: number;
  t: number;
  w: number;
  h: number;
  r: number;
  tr: string;
}

const BOLA = 10;

function mesmaCaixa(a: Caixa, b: Caixa) {
  return a.l === b.l && a.t === b.t && a.w === b.w && a.h === b.h;
}

function usarIndicador(rota: string, recolhida: boolean, mobile: boolean) {
  const rolagem = useRef<HTMLDivElement>(null);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const atual = useRef<Caixa | null>(null);
  const rotaDoIndicador = useRef<string | null>(null);
  const rotaViva = useRef(rota);
  const recolhidaViva = useRef(recolhida);
  const animando = useRef(false);
  const relogios = useRef<number[]>([]);
  rotaViva.current = rota;
  recolhidaViva.current = recolhida;

  const definir = useCallback((c: Caixa | null) => {
    atual.current = c;
    setCaixa(c);
  }, []);

  const posicionar = useCallback(() => {
    const nav = rolagem.current;
    if (mobile || !nav) return;
    const botao = nav.querySelector<HTMLElement>('.barra-item[aria-current="page"]');
    if (!botao) {
      if (atual.current) definir(null);
      rotaDoIndicador.current = null;
      return;
    }
    const alvo: Caixa = { l: botao.offsetLeft, t: botao.offsetTop, w: botao.offsetWidth, h: botao.offsetHeight, r: 8, tr: "none" };
    const antes = atual.current;
    if (rotaDoIndicador.current && rotaDoIndicador.current !== rotaViva.current && antes) {
      rotaDoIndicador.current = rotaViva.current;
      animar(antes, alvo, nav.clientWidth);
      return;
    }
    rotaDoIndicador.current = rotaViva.current;
    if (animando.current) return;
    if (!antes || !mesmaCaixa(antes, alvo)) definir(alvo);
  }, [definir, mobile]);

  const animar = (o: Caixa, alvo: Caixa, largura: number) => {
    relogios.current.forEach(clearTimeout);
    animando.current = true;
    const bola = (x: Caixa): Caixa => ({ l: Math.round(x.l + x.w / 2 - BOLA / 2), t: Math.round(x.t + x.h / 2 - BOLA / 2), w: BOLA, h: BOLA, r: BOLA / 2, tr: "" });
    const distancia = Math.abs(alvo.t - o.t) + Math.abs(alvo.l - o.l);
    const duracao = Math.round(Math.min(640, Math.max(320, distancia * 1.2)));
    const meio = Math.round(duracao / 2);
    const inicio = bola(o);
    const fim = bola(alvo);
    const cx = (inicio.l + fim.l) / 2;
    const folga = Math.max(0, Math.min(largura - BOLA - 4 - cx, cx - 4));
    const arco = Math.round(Math.min(folga, 18 + distancia * 0.28));
    const lado = cx + arco <= largura - BOLA - 4 ? 1 : -1;
    const fechada = recolhidaViva.current;
    let pico: Caixa = { l: Math.round(cx + lado * arco), t: Math.round((inicio.t + fim.t) / 2), w: BOLA, h: BOLA, r: BOLA / 2, tr: "" };
    if (fechada) {
      const estica = Math.round(Math.min(46, 14 + Math.abs(alvo.t - o.t) * 0.22));
      const fina = 7;
      pico = { l: Math.round(cx + lado * Math.min(arco, 6) + (BOLA - fina) / 2), t: Math.round((inicio.t + fim.t) / 2 + BOLA / 2 - estica / 2), w: fina, h: estica, r: fina / 2, tr: "" };
    }
    const forma = fechada ? `${meio}ms` : "0.2s";
    const transicao = (ms: number, curvaX: string, curvaY: string) =>
      `left ${ms}ms ${curvaX}, top ${ms}ms ${curvaY}, width ${forma} ${curvaY}, height ${forma} ${curvaY}, border-radius 0.2s`;
    definir({ ...inicio, tr: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)" });
    relogios.current = [
      window.setTimeout(() => definir({ ...pico, tr: transicao(meio, "cubic-bezier(0.2, 0.7, 0.3, 1)", "cubic-bezier(0.5, 0, 0.75, 0.4)") }), 180),
      window.setTimeout(() => definir({ ...fim, tr: transicao(meio, "cubic-bezier(0.6, 0, 0.8, 0.3)", "cubic-bezier(0.25, 0.6, 0.5, 1)") }), 180 + meio),
      window.setTimeout(() => definir({ ...alvo, tr: "all 0.28s cubic-bezier(0.34, 1.4, 0.5, 1)" }), 180 + duracao),
      window.setTimeout(() => {
        animando.current = false;
        posicionar();
      }, 180 + duracao + 300),
    ];
  };

  useLayoutEffect(() => {
    posicionar();
  });

  useEffect(() => {
    if (mobile) return;
    const t = [120, 240].map((ms) => window.setTimeout(posicionar, ms));
    return () => t.forEach(clearTimeout);
  }, [recolhida, posicionar, mobile]);

  useEffect(() => {
    const nav = rolagem.current;
    if (mobile || !nav) return;
    const obs = new ResizeObserver(() => posicionar());
    obs.observe(nav);
    const mudancas = new MutationObserver(() => posicionar());
    mudancas.observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-current", "hidden"] });
    void document.fonts?.ready.then(() => posicionar());
    const ativos = relogios;
    return () => {
      obs.disconnect();
      mudancas.disconnect();
      ativos.current.forEach(clearTimeout);
      animando.current = false;
      rotaDoIndicador.current = null;
    };
  }, [posicionar, mobile]);

  return { rolagem, caixa };
}

function AcessoMobileDaIlha() {
  const config = useConfig((s) => s.ilha);
  const desligadas = useConfig((s) => s.funcoesDesligadas);
  const usuario = useAuth((s) => s.usuario);
  const aberta = useIlha((s) => s.estado === "expandida");
  const { novas } = usarResumoDoInventario();
  if (!config.ativa) return null;
  const pendentes = abasVisiveisDaIlha(usuario, config, desligadas).includes("materiais") ? novas : 0;
  const rotuloPendentes = pendentes === 1 ? "1 solicitação de material por ver" : `${pendentes} solicitações de material por ver`;
  return (
    <div className="barra-mobile-ilha">
      <button type="button" className="barra-mobile-ilha-botao" aria-expanded={aberta} aria-controls={aberta ? "ilha-mobile-painel" : undefined} onClick={() => {
        const ilha = useIlha.getState();
        if (aberta) ilha.recolher();
        else ilha.abrir(pendentes > 0 ? "materiais" : undefined);
        void tocarSom(aberta ? "close" : "open");
      }}>
        <span>Ilha</span>
        {pendentes > 0 && <span className="barra-mobile-ilha-contador" aria-label={rotuloPendentes}>{pendentes > 99 ? "99+" : pendentes}</span>}
        <ChevronDown size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

export function BarraLateral({ recolhida, mobile = false }: { recolhida: boolean; mobile?: boolean }) {
  const barra = useConfig((s) => s.barraLateral);
  const tema = useConfig((s) => s.tema);
  const nome = useConfig((s) => s.nome);
  const fechados = useConfig((s) => s.gruposFechados);
  const definir = useConfig((s) => s.definir);
  const rota = useInterface((s) => s.rota);
  const appEmpresa = useInterface((s) => s.parametros.app ?? "");
  const area = useInterface((s) => s.area);
  const definirArea = useInterface((s) => s.definirArea);
  const irPara = useInterface((s) => s.irPara);
  const tarefas = useRotina((s) => s.tarefas);
  const mudarStatus = useRotina((s) => s.mudarStatus);
  const contadores = useContadores();
  const { rolagem, caixa } = usarIndicador(rota === "appsEmpresa" ? `${rota}:${appEmpresa}` : rota, recolhida, mobile);
  const menuMobile = useRef<HTMLDialogElement>(null);
  const logout = useAuth((s) => s.logout);
  const usuario = useAuth((s) => s.usuario);
  const naoLidasWhatsapp = useWhatsapp((s) => s.estado?.naoLidas ?? 0);
  const nomeExibido = nome || usuario?.nome || T.barraLateral.perfil;
  const [fade, setFade] = useState({ topo: false, base: false });
  const desligadas = useConfig((s) => s.funcoesDesligadas);
  const hoje = tarefasDoDia(tarefas.filter((t) => area === "empresa" ? t.area === "empresa" : t.area !== "empresa"), hojeISO()).filter((t) => t.status !== "cancelada").slice(0, 5);
  const visiveis = itensVisiveisDaBarra(barra, area, usuario, desligadas);
  const rotasNoTopo = area === "empresa" ? ROTAS_NO_TOPO_EMPRESA : [];
  const itensNoTopo = visiveis.filter((i) => rotasNoTopo.includes(i.rota));
  const dono = ehDono(usuario);
  const podeConfigurar = podeAcessarRota(usuario, "configuracoes", area);
  const mostrarHoje = funcaoLigada("journal", desligadas);

  useEffect(() => {
    if (!usuario || dono) return;
    if (area !== "empresa") definirArea("empresa");
    if (!podeAcessarRota(usuario, rota, "empresa")) irPara("escritorio");
  }, [area, definirArea, dono, irPara, rota, usuario]);

  useEffect(() => {
    const el = rolagem.current;
    if (mobile || !el) return;
    const medir = () => setFade({ topo: el.scrollTop > 4, base: el.scrollTop + el.clientHeight < el.scrollHeight - 4 });
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    el.querySelectorAll(".barra-grupo").forEach((grupo) => obs.observe(grupo));
    return () => {
      el.removeEventListener("scroll", medir);
      obs.disconnect();
    };
  }, [recolhida, fechados.length, rolagem, mobile]);

  const grupos = (["principal", "organizacao", "ferramentas"] as const).map((g) => ({
    grupo: g,
    itens: visiveis.filter((i) => GRUPO_DA_ROTA[i.rota] === g && i.rota !== "configuracoes" && !rotasNoTopo.includes(i.rota)),
  }));

  const alternarGrupo = (g: string) => definir({ gruposFechados: fechados.includes(g) ? fechados.filter((x) => x !== g) : [...fechados, g] });

  const recolherBarra = (proxima: boolean) => {
    const ui = useInterface.getState();
    if (ui.barraAppsRecolhida !== null) ui.definirBarraAppsRecolhida(proxima);
    else definir({ barraRecolhida: proxima });
  };

  const trocarArea = (proxima: AreaSistema) => {
    if (!podeAcessarArea(usuario, proxima)) return;
    if (proxima === area) return;
    definirArea(proxima);
    if (!rotaDisponivelNaArea(rota, proxima)) irPara(primeiraRotaDaArea(proxima));
  };

  const fecharMenu = () => menuMobile.current?.close();
  const navegar = (destino: Rota, parametros?: Record<string, string>) => {
    fecharMenu();
    irPara(destino, parametros);
  };
  const rotuloDaRota = (destino: Rota) => (area === "pessoal" ? ROTULOS_PESSOAIS[destino] : ROTULOS_EMPRESA[destino]) || T.rotas[destino];

  const item = (r: Rota, nomeItem?: string) => {
    const Icone = r === "escritorio" ? LayoutDashboard : ICONE_ROTA[r];
    const ativo = rota === r;
    const rotulo = nomeItem || rotuloDaRota(r);
    const posicao = visiveis.findIndex((v) => v.rota === r) + 1;
    const contador = contadores[r];
    const atalho = posicao > 0 && posicao <= 9 ? ` (Ctrl + ${posicao})` : "";
    const compacto = nomeItem || ({ conexoes: "Conexões", calendario: area === "empresa" ? T.rotas.calendario : "Agenda", journal: "Rotina", metas: "Objetivos" } as Partial<Record<Rota, string>>)[r] || T.rotas[r];
    return (
      <button key={r} type="button" className="barra-item" data-rota={r} aria-label={rotulo} aria-current={ativo ? "page" : undefined} title={`${rotulo}${atalho}`} onClick={() => navegar(r)}>
        <Icone size={16} />
        <span className="barra-item-texto cortar">{recolhida ? compacto : rotulo}</span>
        {contador && contador.n > 0 && <span className={`barra-contador ${contador.alerta ? "barra-contador-alerta" : ""}`} aria-label={String(contador.n)}>{recolhida ? "" : contador.n}</span>}
      </button>
    );
  };

  const itemDoWhatsapp = () => (
    <button key="whatsapp" type="button" className="barra-item barra-whatsapp" data-rota="whatsapp" aria-label={T.rotas.whatsapp} aria-current={rota === "whatsapp" ? "page" : undefined} title={T.rotas.whatsapp} onClick={() => navegar("whatsapp")}>
      <Marca marca="whatsapp" tamanho={15} monocromatica={rota === "whatsapp"} />
      <span className="barra-item-texto cortar">{T.rotas.whatsapp}</span>
      {naoLidasWhatsapp > 0 && <span className="barra-contador barra-contador-whatsapp" aria-label={String(naoLidasWhatsapp)}>{recolhida ? "" : naoLidasWhatsapp > 99 ? "99+" : naoLidasWhatsapp}</span>}
    </button>
  );

  const itemDoGrupo = (i: ItemBarra) => {
    const props = { recolhida, nome: i.nome, aoNavegar: fecharMenu };
    switch (i.rota) {
      case "appsEmpresa": return <AppsEmpresaNoMenu key={i.rota} {...props} />;
      case "powerBi": return <PowerBiNoMenu key={i.rota} {...props} />;
      case "planilhasEmpresa": return <PlanilhasNoMenu key={i.rota} {...props} />;
      case "conexoes": return <div key={i.rota} className="barra-conexoes">{item(i.rota, i.nome)}{itemDoWhatsapp()}</div>;
      default: return item(i.rota, i.nome);
    }
  };

  const sistemaEscuro = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const escuroAgora = tema === "escuro" || (tema === "sistema" && sistemaEscuro);
  const hojeFechado = fechados.includes("hoje");
  const rotuloTema = escuroAgora ? T.barraLateral.temaClaro : T.barraLateral.temaEscuro;
  const emAjustes = rota === "configuracoes";

  const conteudo = (
    <>
      {!mobile && <div className="barra-topo">
        <LogoNiko tamanho={26} />
        {!recolhida && <span className="barra-marca">{T.app.nome}</span>}
        {!recolhida && (
          <button type="button" className="botao botao-fantasma botao-pequeno botao-icone empurrar" aria-label={T.barraLateral.recolher} title={`${T.barraLateral.recolher} (Ctrl + B)`} onClick={() => recolherBarra(true)}>
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>}
      {recolhida && (
        <button type="button" className="barra-icone barra-icone-largo barra-expandir" aria-label={T.barraLateral.expandir} title={`${T.barraLateral.expandir} (Ctrl + B)`} onClick={() => recolherBarra(false)}>
          <PanelLeftOpen size={16} />
        </button>
      )}
      {!dono && usuario ? <div className="barra-contexto-identidade" title="Empresa · Espaço de trabalho">
        <Building2 size={16} />
        <span><strong>Empresa</strong>{!recolhida && <small>Espaço de trabalho</small>}</span>
      </div> : <div className="barra-contexto" role="tablist" aria-label="Área do sistema">
        {dono && <button type="button" className="barra-contexto-botao" data-ativo={area === "pessoal" ? "sim" : "nao"} role="tab" aria-selected={area === "pessoal"} title="Pessoal" onClick={() => trocarArea("pessoal")}>
          <UserRound size={14} />
          <span>Pessoal</span>
        </button>}
        <button type="button" className="barra-contexto-botao" data-ativo={area === "empresa" ? "sim" : "nao"} role="tab" aria-selected={area === "empresa"} title="Empresa" onClick={() => trocarArea("empresa")}>
          <Building2 size={14} />
          <span>Empresa</span>
        </button>
      </div>}
      <div ref={rolagem} className="barra-rolagem" data-fade-topo={fade.topo ? "sim" : "nao"} data-fade-base={fade.base ? "sim" : "nao"}>
        {!mobile && <span
          className="barra-indicador"
          aria-hidden="true"
          style={caixa ? { left: caixa.l, top: caixa.t, width: caixa.w, height: caixa.h, borderRadius: caixa.r, transition: caixa.tr, opacity: 1 } : { left: 0, top: 0, width: 0, height: 0, opacity: 0 }}
        />}
        {itensNoTopo.length > 0 && <div className="barra-grupo">{itensNoTopo.map((i) => item(i.rota, i.nome))}</div>}
        {grupos.map(({ grupo, itens }) => {
          if (itens.length === 0) return null;
          const fechado = !recolhida && fechados.includes(grupo) && !itens.some((i) => i.rota === rota || (rota === "whatsapp" && i.rota === "conexoes"));
          return (
            <div key={grupo} className="barra-grupo" data-grupo={grupo}>
              {!recolhida && (
                <button type="button" className="barra-rotulo" aria-expanded={!fechado} onClick={() => alternarGrupo(grupo)}>
                  <span className="rotulo-secao">{T.gruposBarra[grupo]}</span>
                  <ChevronDown size={12} className="barra-rotulo-seta" />
                </button>
              )}
              {!fechado && itens.map(itemDoGrupo)}
            </div>
          );
        })}
        {!mobile && !recolhida && mostrarHoje && (area !== "empresa" || hoje.length > 0) && (
          <div className="barra-grupo" data-grupo="hoje">
            <button type="button" className="barra-rotulo" aria-expanded={!hojeFechado} onClick={() => alternarGrupo("hoje")}>
              <span className="rotulo-secao">{T.gruposBarra.hoje}</span>
              <ChevronDown size={12} className="barra-rotulo-seta" />
            </button>
            {!hojeFechado &&
              (hoje.length === 0 ? (
                <span className="barra-hoje-vazio">{T.barraLateral.semTarefasHoje}</span>
              ) : (
                hoje.map((t) => {
                  const feita = t.status === "concluida";
                  return (
                    <div key={t.id} className="barra-hoje">
                      <button type="button" role="checkbox" aria-checked={feita} aria-label={feita ? T.geral.reabrir : T.geral.concluir} onClick={() => mudarStatus(t.id, feita ? "a_fazer" : "concluida")} className="marcador marcador-pequeno">
                        <Check />
                      </button>
                      <span className={`cortar ${feita ? "riscado" : ""}`}>{t.titulo}</span>
                      {t.hora && <span className="texto-3 numero empurrar">{t.hora}</span>}
                    </div>
                  );
                })
              ))}
          </div>
        )}
      </div>
      <div className="barra-base">
        <IndicadorSincronia recolhida={recolhida} />
        <div className="barra-base-linha">
          <button type="button" className="barra-perfil" title={podeConfigurar ? T.perfil.abrirPerfil : nomeExibido} disabled={!podeConfigurar} onClick={() => navegar("configuracoes", { secao: "geral" })}>
            <Avatar tamanho={28} />
            {!recolhida && <span className="barra-perfil-identidade"><strong className="cortar">{nomeExibido}</strong><small>{usuario ? rotuloDoPapel(usuario.perfil) : "Seu perfil"}</small></span>}
          </button>
          <div className="barra-acoes">
              <button type="button" className="barra-icone" role="switch" aria-checked={escuroAgora} aria-label={rotuloTema} title={rotuloTema} onClick={(evento) => mudarTema(escuroAgora ? "claro" : "escuro", evento.currentTarget)}>
                {escuroAgora ? <Moon size={15} /> : <Sun size={15} />}
              </button>
              {!mobile && podeConfigurar && <button type="button" className="barra-icone" data-tour="ajustes" aria-current={emAjustes ? "page" : undefined} aria-label={T.rotas.configuracoes} title={T.rotas.configuracoes} onClick={() => navegar("configuracoes")}>
                <Settings size={15} />
              </button>}
              <button type="button" className="barra-icone barra-sair" aria-label="Sair da conta" title="Sair da conta" onClick={() => { fecharMenu(); void logout(); }}>
                <LogOut size={15} />
              </button>
          </div>
        </div>
      </div>
    </>
  );

  if (!mobile) return <nav className={`barra-lateral ${recolhida ? "barra-recolhida" : ""}`} aria-label={T.barraLateral.navegacao}>{conteudo}</nav>;

  const nomeDaRota = visiveis.find((item) => item.rota === rota)?.nome || rotuloDaRota(rota);
  return (
    <>
      <header className="barra-mobile-topo">
        <LogoNiko tamanho={32} />
        <div className="barra-mobile-contexto">
          <strong>{T.app.nome}</strong>
          <span className="cortar">{area === "empresa" ? "Empresa" : "Pessoal"} · {nomeDaRota}</span>
        </div>
        {podeConfigurar && <button type="button" className="barra-mobile-acao" data-tour="ajustes" aria-current={emAjustes ? "page" : undefined} aria-label={T.rotas.configuracoes} onClick={() => navegar("configuracoes")}>
          <Settings size={19} />
        </button>}
        <button type="button" className="barra-mobile-acao barra-mobile-abrir" aria-haspopup="dialog" aria-controls="barra-mobile-menu" onClick={() => menuMobile.current?.showModal()}>
          <Menu size={19} /> Menu
        </button>
      </header>
      <AcessoMobileDaIlha />
      <dialog id="barra-mobile-menu" className="barra-mobile-menu" ref={menuMobile} aria-labelledby="barra-mobile-titulo" onClick={(evento) => {
        if (evento.target === evento.currentTarget) fecharMenu();
      }}>
        <nav className="barra-lateral" aria-labelledby="barra-mobile-titulo">
          <div className="barra-mobile-cabecalho">
            <h2 id="barra-mobile-titulo">Menu</h2>
            <button type="button" className="barra-mobile-acao" aria-label="Fechar menu" onClick={fecharMenu}><X size={21} /></button>
          </div>
          {conteudo}
        </nav>
      </dialog>
    </>
  );
}
