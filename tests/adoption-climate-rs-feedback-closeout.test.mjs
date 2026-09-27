import assert from 'node:assert/strict';
import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';
import { calculateQuantitativeProgress } from '../src/domain/adoption/classification.ts';
import { consolidateIndicator } from '../scripts/ingestion/consolidation.mjs';
import { detectFileType, processFiles } from '../scripts/ingestion/core.mjs';
import { adoptionMatrix } from '../src/domain/adoption/matrix.ts';

const module = (name) => adoptionMatrix.find((item) => item.name === name);
const specifications = [
  ['Pesquisa de Clima', [['climate-survey-created', 20, 'configuracao'], ['responses', 80, 'uso']]],
  ['Recrutamento e Seleção', [['jobs-portal', 15, 'configuracao'], ['selection-stages', 25, 'configuracao'], ['candidates', 60, 'uso']]],
  ['Feedbacks', [['feedback-configured', 10, 'configuracao'], ['praise-types', 10, 'configuracao'], ['praises-history', 30, 'uso'], ['feedbacks-history', 50, 'uso']]],
];
for (const [name, expected] of specifications) {
  const rules = module(name).rules;
  assert.equal(rules.reduce((sum, item) => sum + item.weight, 0), 100, `${name} weights total 100`);
  assert.deepEqual(rules.map(({ id, weight, section }) => [id, weight, section]), expected, `${name} approved matrix`);
}

assert.equal(calculateAdoptionModule('Pesquisa de Clima', { 'climate-survey-created': 0, responses: 0 }).score, 0);
assert.equal(calculateAdoptionModule('Pesquisa de Clima', { 'climate-survey-created': 20, responses: 270 }).score, 84);
assert.equal(calculateAdoptionModule('Pesquisa de Clima', { 'climate-survey-created': 20, responses: null }).score, null);
assert.equal(calculateQuantitativeProgress(20).percentage, 20);
assert.equal(calculateQuantitativeProgress(270).percentage, 100);

const climateSum = consolidateIndicator('SOMAR', [{ unitId: 'a', value: 20 }, { unitId: 'b', value: 250 }]);
assert.equal(climateSum.value, 270);
const climateConsolidatedScore = calculateAdoptionModule('Pesquisa de Clima', { 'climate-survey-created': 20, responses: climateSum.value }).score;
const climateLocalScores = [
  calculateAdoptionModule('Pesquisa de Clima', { 'climate-survey-created': 1, responses: 15 }).score,
  calculateAdoptionModule('Pesquisa de Clima', { 'climate-survey-created': 19, responses: 255 }).score,
];
assert.equal(climateConsolidatedScore, 84);
assert.notEqual(climateConsolidatedScore, climateLocalScores.reduce((a, b) => a + b, 0) / climateLocalScores.length);

const rsTrue = calculateAdoptionModule('Recrutamento e Seleção', { 'jobs-portal': true, 'selection-stages': 0, candidates: 0 });
assert.equal(rsTrue.indicators.find((item) => item.id === 'jobs-portal').contribution, 15);
assert.equal(calculateAdoptionModule('Recrutamento e Seleção', { 'jobs-portal': false, 'selection-stages': 0, candidates: 0 }).score, 0);
assert.equal(calculateAdoptionModule('Recrutamento e Seleção', { 'jobs-portal': true, 'selection-stages': 115, candidates: 480 }).score, 100);
assert.equal(calculateAdoptionModule('Recrutamento e Seleção', { 'jobs-portal': null, 'selection-stages': 1, candidates: 1 }).score, null);
assert.equal(consolidateIndicator('ANY', [{ unitId: 'a', value: false }, { unitId: 'b', value: true }]).value, true);
assert.equal(consolidateIndicator('ANY', [{ unitId: 'a', value: false }, { unitId: 'b', value: false }]).value, false);
assert.equal(consolidateIndicator('ANY', []).value, null);
assert.equal(consolidateIndicator('ANY', [{ unitId: 'a', value: null }]).value, null);
assert.equal(consolidateIndicator('ANY', [{ unitId: 'a', value: false }, { unitId: 'b', value: null }]).value, null);
assert.equal(consolidateIndicator('SOMAR', [{ unitId: 'a', value: 5 }, { unitId: 'b', value: 7 }]).value, 12);

const feedbacks = calculateAdoptionModule('Feedbacks', { 'feedback-configured': true, 'praise-types': 30, 'praises-history': 39, 'feedbacks-history': 128 });
assert.equal(feedbacks.score, 75);
assert.deepEqual(feedbacks.indicators.map((item) => item.contribution), [10, 3, 12, 50]);
assert.equal(calculateAdoptionModule('Feedbacks', { 'feedback-configured': true, 'praise-types': 0, 'praises-history': 0, 'feedbacks-history': 0 }).score, 10);
assert.equal(calculateAdoptionModule('Feedbacks', { 'feedback-configured': null, 'praise-types': 0, 'praises-history': 0, 'feedbacks-history': 0 }).score, null);
assert.equal(consolidateIndicator('ANY', [{ unitId: 'a', value: true }, { unitId: 'b', value: null }]).value, true);
for (const raw of ['qtd_elogios', 'qtd_feedbacks']) assert.ok(!module('Feedbacks').rules.some((rule) => rule.id === 'praises-and-feedbacks' || rule.id === raw));
assert.equal(consolidateIndicator('SOMAR', [{ unitId: 'a', value: 4 }, { unitId: 'b', value: 35 }]).value, 39);

// Parser regression: overlapping climate/communication columns retain module identity by real schema and file context.
const climateHeaders = ['cliente_id', 'cliente_nome', 'unidade_id', 'unidade_nome', 'qtd_questionarios', 'qtd_respostas_questionario'];
const communicationHeaders = [...climateHeaders.slice(0, 4), 'qtd_comunicados', ...climateHeaders.slice(4)];
assert.equal(detectFileType(climateHeaders, 'Módulo Pesquisa de clima  02.09.26.csv').module, 'Pesquisa de Clima');
assert.equal(detectFileType(communicationHeaders, 'Módulo comunicacao  02.09.26-1788406722550.csv').module, 'Comunicação');

// Pipeline integration: contracted zero is averaged; missing contracted and non-contracted modules do not participate.
const files = [
  { filename: 'clientes.csv', content: Buffer.from('Task Name,6. PLANO: (drop down),1. JORNADA DO CLIENTE: (drop down),11. CSM Responsável (users)\nCliente PO,QuarkRH Essencial,Em operação,Marina\nCliente Zero,QuarkRH Essencial,Em operação,Marina\n') },
  { filename: 'Módulo Pesquisa de clima  02.09.26.csv', content: Buffer.from('cliente_id,cliente_nome,unidade_id,unidade_nome,qtd_questionarios,qtd_respostas_questionario\n1,Cliente PO,U-A,Unidade A,0,0\n1,Cliente PO,U-B,Unidade B,20,270\n2,Cliente Zero,U-Z,Unidade Zero,0,0\n') },
  { filename: 'Módulo R&S 02.09.26.csv', content: Buffer.from('cliente_id,cliente_nome,unidade_id,unidade_nome,portal_publico_configurado,qtd_etapas_processo,qtd_inscritos\n1,Cliente PO,U-A,Unidade A,true,0,0\n1,Cliente PO,U-B,Unidade B,false,0,0\n') },
  { filename: 'Módulo perfil comportamental  02.09.26.csv', content: Buffer.from('cliente_id,cliente_nome,unidade_id,unidade_nome,teste_comportamental_liberado,qtd_respostas\n1,Cliente PO,U-A,Unidade A,true,96\n1,Cliente PO,U-B,Unidade B,true,96\n') },
];
const pipeline = await processFiles(files);
assert.equal(pipeline.canProcess, true);
const customer = pipeline.customers.find((item) => item.clienteNome === 'Cliente PO');
assert.equal(customer.modules.length, 18);
assert.equal(customer.modules.find((item) => item.name === 'Pesquisa de Clima').score, 84);
assert.equal(customer.modules.find((item) => item.name === 'Recrutamento e Seleção').score, 15);
assert.equal(customer.modules.find((item) => item.name === 'Recrutamento e Seleção').contractStatus, 'contratado');
assert.equal(customer.modules.find((item) => item.name === 'Perfil Comportamental').score, null);
assert.equal(customer.modules.find((item) => item.name === 'Perfil Comportamental').contractStatus, 'nao_incluso');
assert.equal(customer.modules.find((item) => item.name === 'Feedbacks').score, null);
assert.equal(customer.overallScore, 49.5);
const climateUnits = customer.units.map((unit) => ({ id: unit.unitId, score: unit.modules.find((item) => item.name === 'Pesquisa de Clima').score }));
assert.deepEqual(climateUnits, [{ id: 'U-A', score: 0 }, { id: 'U-B', score: 84 }]);
const zeroCustomer = pipeline.customers.find((item) => item.clienteNome === 'Cliente Zero');
assert.equal(zeroCustomer.modules.find((item) => item.name === 'Pesquisa de Clima').score, 0);
assert.equal(zeroCustomer.overallScore, 0, 'contracted calculated zero participates in overallScore');

console.log('Climate/R&S/Feedbacks closeout tests passed: approved matrices, quantitative progress, zero/null, ANY/SOMAR, real parser identities, pipeline module/unit contract and overallScore.');
