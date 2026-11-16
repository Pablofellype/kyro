import test from 'node:test';
import assert from 'node:assert/strict';
import { posicaoDoPainel } from '../src/janelas/ilha/barra/posicaoDoPainel.ts';

test('painéis ficam fora da ilha ou abaixo dela quando falta espaço lateral', () => {
  for (const tela of [768, 1024, 1366, 1920]) {
    for (const largura of [300, 780]) {
      for (const lado of ['esquerda', 'direita']) {
        const painel = lado === 'esquerda' ? 320 : 398;
        const posicao = posicaoDoPainel(lado, painel, tela, { largura, altura: 400 });
        const inicio = (tela - largura) / 2;
        assert.ok(posicao.esquerda + painel <= inicio || posicao.esquerda >= inicio + largura || posicao.topo >= 416);
        assert.ok(posicao.esquerda >= 8);
        assert.ok(posicao.esquerda + painel <= tela - 8);
      }
    }
  }
});
