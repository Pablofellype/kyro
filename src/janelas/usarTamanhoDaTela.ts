import { useEffect, useState } from "react";

export interface TamanhoDaTela {
  largura: number;
  altura: number;
}

// A janela da ilha tem altura fixa e pode passar da tela em monitores pequenos; a altura útil vem do monitor.
function medir(): TamanhoDaTela {
  const alturaDoMonitor = window.screen?.availHeight || window.innerHeight;
  return { largura: window.innerWidth, altura: Math.min(window.innerHeight, alturaDoMonitor) };
}

export function verificarSeEhMobile(tela?: TamanhoDaTela): boolean {
  if (typeof window === "undefined") return false;
  const largura = tela?.largura ?? window.innerWidth;
  const altura = tela?.altura ?? window.innerHeight;

  const ua = navigator.userAgent || "";
  const ehUaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const temTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // Celular na horizontal (paisagem): largura maior (ex: 600-950px), mas altura compacta (<= 540px)
  const ehPaisagemMobile = altura <= 540 && (temTouch || ehUaMobile || largura <= 1024);

  // Celular na vertical (retrato): largura estreita
  const ehRetratoMobile = largura <= 768;

  // Dispositivo móvel geral (qualquer orientação)
  if (ehUaMobile && (largura <= 1100 || altura <= 700)) return true;

  return ehRetratoMobile || ehPaisagemMobile;
}

export function usarTamanhoDaTela(): TamanhoDaTela {
  const [tamanho, setTamanho] = useState(medir);
  useEffect(() => {
    const atualizar = () => setTamanho((anterior) => {
      const novo = medir();
      return novo.largura === anterior.largura && novo.altura === anterior.altura ? anterior : novo;
    });
    window.addEventListener("resize", atualizar);
    window.addEventListener("orientationchange", atualizar);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener("change", atualizar);
    }
    return () => {
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("orientationchange", atualizar);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener("change", atualizar);
      }
    };
  }, []);
  return tamanho;
}

// Menor escala entre a escolhida e a que faz o conteúdo caber, com um piso para continuar legível.
export function escalaQueCabe(escolhida: number, conteudo: TamanhoDaTela, espaco: TamanhoDaTela, piso = 0.6): number {
  const cabe = Math.min(espaco.largura / Math.max(1, conteudo.largura), espaco.altura / Math.max(1, conteudo.altura));
  const ehMob = verificarSeEhMobile(espaco);
  const pisoMobile = ehMob ? Math.min(0.4, cabe) : piso;
  return Math.max(Math.min(pisoMobile, escolhida), Math.min(escolhida, cabe));
}
