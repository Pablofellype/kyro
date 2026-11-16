export function posicaoDoPainel(lado: "esquerda" | "direita", largura: number, tela: number, ilha: { largura: number; altura: number }) {
  const margem = 8;
  const inicio = (tela - ilha.largura) / 2;
  const fim = inicio + ilha.largura;
  const cabe = lado === "esquerda" ? inicio >= largura + margem * 2 : tela - fim >= largura + margem * 2;
  const esquerda = lado === "esquerda" ? inicio - largura - margem : fim + margem;
  return {
    esquerda: Math.max(margem, Math.min(esquerda, tela - largura - margem)),
    topo: cabe ? 48 : Math.max(48, ilha.altura + 16),
  };
}
