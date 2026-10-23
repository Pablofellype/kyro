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

export function usarTamanhoDaTela(): TamanhoDaTela {
  const [tamanho, setTamanho] = useState(medir);
  useEffect(() => {
    const atualizar = () => setTamanho((anterior) => {
      const novo = medir();
      return novo.largura === anterior.largura && novo.altura === anterior.altura ? anterior : novo;
    });
    window.addEventListener("resize", atualizar);
    return () => window.removeEventListener("resize", atualizar);
  }, []);
  return tamanho;
}

// Menor escala entre a escolhida e a que faz o conteúdo caber, com um piso para continuar legível.
export function escalaQueCabe(escolhida: number, conteudo: TamanhoDaTela, espaco: TamanhoDaTela, piso = 0.6): number {
  const cabe = Math.min(espaco.largura / Math.max(1, conteudo.largura), espaco.altura / Math.max(1, conteudo.altura));
  const pisoMobile = espaco.largura <= 768 ? Math.min(0.4, cabe) : piso;
  return Math.max(Math.min(pisoMobile, escolhida), Math.min(escolhida, cabe));
}
