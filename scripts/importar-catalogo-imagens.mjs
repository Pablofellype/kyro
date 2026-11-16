import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { criarServidorDeTeste } from './vite-para-testes.mjs';
for (const linha of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(linha);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
// Transcrição das capturas de 16/11/2026. Códigos provisórios autorizados pelo dono.
const linhas = `LUVA NEOPRENE;7000407
LUVA CUTGRIP;7004250
ÓCULOS POLICARBONATO;7000427
BOTA PRETA;Nº 33:7003123|Nº 34:7003124|Nº 35:7003125|Nº 36:7003126|Nº 37:7003127|Nº 38:7003128|Nº 39:7003129|Nº 40:7003130|Nº 41:7003132|Nº 42:7003133|Nº 43:7003134|Nº 44:7003136|Nº 45:7003137|Nº 46:7003138|Nº 47:7003139
BOTA BRANCA;Nº 36:7000062|Nº 37:7000063|Nº 38:7000061|Nº 39:7000068|Nº 40:7000064|Nº 41:7000065|Nº 42:7000066|Nº 43:7000034|Nº 44:7005781|Nº 45:7003704
CALÇA MASCULINA;Nº 38:7000101|Nº 40:7000102|Nº 42:7000103|Nº 44:7000104|Nº 46:7000105|Nº 48:7000106|Nº 50:7000107|Nº 52:7000108|Nº 56:7000109|Nº 58:7000110
CALÇA FEMININA;Nº 36:7000111|Nº 38:7000112|Nº 40:7000113|Nº 42:7000114|Nº 44:7000115|Nº 46:7000116|Nº 48:7000117
CALÇA TATICA SEGURANÇA;Nº 38:7005537|Nº 40:7005538|Nº 42:7005539|Nº 44:7005540|Nº 46:7006330|Nº 48:7005541|Nº 50:7006331|Nº 56:7005542|Nº 58:7006332
CAMISETA SEGURANÇA;P:7000141|M:7000140|G:7000138|GG:7000139|EXG:7000137
JAQUETA SEGURANÇA;P:7000387|M:7000386|G:7000384|GG:7000385
CAPA DE CHUVA SEGURANÇA;7000246
CASACO;P:7000424|M:7000426|G:7000425|GG:7000423|EXGG:7003493
CAMISETA AMARELA INDÚSTRIA;P:7002162|M:7002165|G:7002167|GG:7002169
CAMISA AZUL INDÚSTRIA;P:7002161|M:7002164|G:7002166|GG:7002168
CAMISETA VERDE INDÚSTRIA;P:7000215|M:7000214|G:7000212|GG:7000213
CAMISETA MASCULINA;P:7008087|M:7008088|G:7008089|GG:7008036
CAMISETA FEMININA;P:7008090|M:7008092|G:7008093|GG:7008091
CAMISETA JARDINAGEM;P:111111|M:222222|G:333333|GG:444444
COLETE REFLETIVO;7004923
PROTETOR NORMAL;7005001
ABAFADOR CONCHA;7000475
MANGUITO;7005931
POCHETE;7001939
MASCARA/RESPIRADOR 3M;7003490
MASCARA DESCARTAVEL;7000885
BONE COCA COLA;7001438
CABO ALUMINIO;7005244
CLEAR BY PEROXY;7005543
TASKI COMBI;7007140
PAPEL HIGIÊNICO;7008101
PAPEL INTERFOLHADO;7000591
PAPEL TOALHA;7008102
SABONETE ANTISSÉPTICO 800ML;7000495
SABONETE NEUTRO 600ML;7007647
ESPONJA;7000318
SACO AZUL GRANDE;7001473
SACO AZUL PEQUENO;7001478
SACO PRETO GRANDE;7000497
SACO PRETO PEQUENO;7001474
PANO;7000500
ABRAÇADEIRA DE NYLON 360MM;9001836
PURIFICADOR BOM AR;7000295
PÁ;7001862
BUCHA LT;7000345
BASE LT;VERDE:555555|VERMELHO:666666|AZUL:777777
DISCOS;PRETO 410:7000301|PRETO 440:7001572|VERDE 350:7002331|VERDE 410:7000302|VERDE 510:7001453
BALDE AZUL;7005597
BALDE VERMELHO;7005598
RODO AZUL;40cm:7000488|60cm:7000489
RODO VERDE;7005688
RODO VERMELHO;40cm:7002813|60cm:7002811
VASSOURA EXTERNA;40cm:7000522|60cm:7000533
VASSOURA PIA;888888
VASSOURA SANITÁRIA;7000525
VASSOURA VERMELHA;7007588
BORRIFADOR;7008151`;
const catalogo = linhas.split('\n').map(linha => {
  const [nome, codigos] = linha.split(';');
  return { nome, variacoes: codigos.split('|').map(parte => {
    const [a,b] = parte.split(':');
    return {tamanho:b ? a : '', codigo:b ?? a};
  })};
});
assert.equal(catalogo.length, 56);
const codigos = catalogo.flatMap(m => m.variacoes.map(v => v.codigo));
assert.equal(new Set(codigos).size, codigos.length, 'Código duplicado');
assert.ok(codigos.every(c => /^\d+$/.test(c)));
const servidor = await criarServidorDeTeste({configFile:false,server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
  const {lerDadosUsuarioComVersao,gravarDadosUsuario} = await servidor.ssrLoadModule('/src/servicos/dadosUsuario.ts');
  const {dados,versao} = await lerDadosUsuarioComVersao(1);
  const salvo = JSON.parse(dados['niko:materiais']);
  const normalizar = nome => nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const materiais = [...salvo.state.materiais];
  let novos = 0;
  for (const item of catalogo) {
    const indice = materiais.findIndex(m => normalizar(m.nome) === normalizar(item.nome));
    if (indice >= 0) materiais[indice] = {...materiais[indice], ...item};
    else { materiais.push({id:`mat-${normalizar(item.nome).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, ...item}); novos++; }
  }
  const valor = JSON.stringify({...salvo,state:{...salvo.state,materiais}});
  if (!process.argv.includes('--gravar')) {
    console.log(JSON.stringify({modo:'previa',materiais:catalogo.length,codigos:codigos.length,novos,existentes:catalogo.length-novos,imagensPreservadas:materiais.filter(m=>m.imagem).length}));
  } else {
    await gravarDadosUsuario(1,{'niko:materiais':valor},versao,'importacao-materiais-20261116');
    const verificado = await lerDadosUsuarioComVersao(1);
    assert.equal(verificado.dados['niko:materiais'],valor);
    console.log(JSON.stringify({gravado:true,materiais:catalogo.length,codigos:codigos.length,novos,imagensPreservadas:materiais.filter(m=>m.imagem).length}));
  }
} finally { await servidor.close(); }
