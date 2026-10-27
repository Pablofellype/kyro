import test from "node:test";
import assert from "node:assert/strict";
import { construirMensagem } from "../servidor/aderencias.ts";
import { configuracaoAderenciasValida, planilhaAderenciaValida } from "../src/modulos/escritorio/aderenciasTipos.ts";

const planilha = (parcial = {}) => planilhaAderenciaValida({ nome: "P1", ...parcial }, "p1");

test("configuração do robô normaliza planilhas e preserva o agendamento", () => {
  const resultado = configuracaoAderenciasValida({
    ativo: true,
    destinoJid: "5511999999999@s.whatsapp.net",
    frequencia: "semanal",
    hora: "07:30",
    diasSemana: [1, 5],
    planilhas: [{ nome: "P1", sheetUrl: "https://docs.google.com/spreadsheets/d/abc/edit", redThreshold: "3" }],
  });
  assert.equal(resultado.ativo, true);
  assert.equal(resultado.frequencia, "semanal");
  assert.equal(resultado.hora, "07:30");
  assert.deepEqual(resultado.diasSemana, [1, 5]);
  assert.equal(resultado.planilhas[0].redThreshold, 3);
});

test("rotinas independentes preservam horários e planilhas diferentes", () => {
  const resultado = configuracaoAderenciasValida({
    destinoJid: "5511999999999@s.whatsapp.net",
    grupos: [
      { id: "manha", nome: "Manhã", ativo: true, frequencia: "diaria", hora: "08:00", planilhas: [{ id: "p1", nome: "P1", sheetUrl: "https://docs.google.com/spreadsheets/d/a/edit" }] },
      { id: "tarde", nome: "Tarde", ativo: true, frequencia: "diaria", hora: "14:00", planilhas: [{ id: "p2", nome: "P2", sheetUrl: "https://docs.google.com/spreadsheets/d/b/edit" }] },
    ],
  });
  assert.equal(resultado.grupos.length, 2);
  assert.equal(resultado.grupos[0].hora, "08:00");
  assert.equal(resultado.grupos[1].hora, "14:00");
  assert.equal(resultado.grupos[0].planilhas[0].id, "p1");
  assert.equal(resultado.grupos[1].planilhas[0].id, "p2");
});

test("robô separa alertas amarelos e vermelhos pelos limiares", () => {
  const resultado = construirMensagem(planilha({ redThreshold: 3, yellowThreshold: 1 }), [
    { texto: "1", area: "Sala A", predio: "P1", cor: "amarelo" },
    { texto: "2", area: "Sala B", predio: "P1", cor: "vermelho" },
    { texto: "3", area: "Sala C", predio: "P1", cor: "vermelho" },
  ]);
  assert.equal(resultado.alertas, 2);
  assert.equal(resultado.urgentes, 1);
  assert.match(resultado.texto, /ATENÇÃO/);
  assert.match(resultado.texto, /CRÍTICO/);
});

test("modo somente print não cria alertas", () => {
  const resultado = construirMensagem(planilha({ soPrint: true }), [{ texto: "9", area: "Sala", predio: "P1", cor: "vermelho" }]);
  assert.equal(resultado.alertas, 0);
  assert.equal(resultado.urgentes, 0);
  assert.match(resultado.texto, /PRINT DE ADERÊNCIA/);
});
