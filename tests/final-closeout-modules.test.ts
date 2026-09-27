import assert from 'node:assert/strict';
import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';
import { calculateQuantitativeProgress } from '../src/domain/adoption/classification.ts';
import { adoptionMatrix } from '../src/domain/adoption/matrix.ts';
import { processFiles } from '../scripts/ingestion/core.mjs';

const getMatrix = (name: string) => adoptionMatrix.find((module) => module.name === name)!;
const score = (name: string, values: Record<string, unknown>, contracted = true) => calculateAdoptionModule(name, values, contracted);
const frequency = getMatrix('Frequência');
assert.deepEqual(frequency.rules.map(({ id, weight, section }) => [id, weight, section]), [
  ['configuration-active', 10, 'configuracao'], ['schedules', 15, 'configuracao'], ['journeys', 15, 'configuracao'],
  ['point-registrants', 30, 'uso'], ['frequency-requests', 20, 'uso'], ['point-treatment', 10, 'uso'],
]);
assert.equal(frequency.rules.reduce((total, rule) => total + rule.weight, 0), 100);
const health = getMatrix('Saúde Ocupacional');
assert.deepEqual(health.rules.map(({ id, weight }) => [id, weight]), [['doctors', 20], ['asos-configured', 40], ['medical-certificates-period', 40]]);
assert.equal(health.rules.reduce((total, rule) => total + rule.weight, 0), 100);
assert.equal(getMatrix('Férias').rules.find((rule) => rule.id === 'vacations-moved-period')?.label, 'Férias homologadas');

for (const value of [0, 1, 5, 6, 10, 11, 15, 50, 70, 71, 73, 75, 76, 80, 90, 95, 96, 120]) {
  const progress = value === 0 ? 0 : Math.min(100, Math.ceil(value / 5) * 5);
  assert.equal(calculateQuantitativeProgress(value).percentage, progress);
  const holidays = score('Férias', { 'vacation-configured': true, 'vacations-imported': value, 'vacations-moved-period': value });
  assert.equal(holidays.indicators.find((item) => item.id === 'vacations-imported')?.contribution, 30 * progress / 100);
  assert.equal(holidays.indicators.find((item) => item.id === 'vacations-moved-period')?.contribution, 40 * progress / 100);
  const occupational = score('Saúde Ocupacional', { doctors: value, 'asos-configured': value, 'medical-certificates-period': value });
  assert.equal(occupational.indicators.find((item) => item.id === 'doctors')?.contribution, 20 * progress / 100);
  assert.equal(occupational.indicators.find((item) => item.id === 'asos-configured')?.contribution, 40 * progress / 100);
  assert.equal(occupational.indicators.find((item) => item.id === 'medical-certificates-period')?.contribution, 40 * progress / 100);
}
for (const flag of [true, false, null]) {
  assert.equal(score('Férias', { 'vacation-configured': flag, 'vacations-imported': 0, 'vacations-moved-period': 0 }).indicators[0].contribution, flag === null ? null : flag ? 30 : 0);
  assert.equal(score('Frequência', { 'configuration-active': flag, schedules: 0, journeys: 0, 'point-registrants': 1, 'active-point-employees': 100, 'frequency-requests': 0, 'point-treatment': 0 }).indicators[0].contribution, flag === null ? null : flag ? 10 : 0);
}
for (const [value, expected] of [[1, 1], [50, 10], [73, 15], [96, 20]] as const) {
  const result = score('Saúde Ocupacional', { doctors: value, 'asos-configured': 0, 'medical-certificates-period': 0 });
  assert.equal(result.indicators.find((item) => item.id === 'doctors')?.contribution, expected);
}
assert.equal(score('Saúde Ocupacional', { doctors: 1, 'asos-configured': 73, 'medical-certificates-period': 73 }).score, 61);
assert.equal(score('Saúde Ocupacional', { doctors: null, 'asos-configured': 0, 'medical-certificates-period': 0 }).score, null);
assert.equal(score('Férias', { 'vacation-configured': false, 'vacations-imported': 0, 'vacations-moved-period': 0 }, false).status, 'nao_contratado');

const csv = (value: string) => Buffer.from(value, 'utf8');
const customers = 'Task Name,6. PLANO: (drop down)\nCONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,QuarkRH Essencial\nPO Test Multi,QuarkRH Essencial';
const vacations = [
  'cliente_nome,unidade_id,unidade_nome,configuracao_ferias_ativa,qtd_ferias_cadastradas,qtd_ferias_via_planilha,qtd_ferias_homologadas',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,1,Mococa,false,0,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,2,Saude,true,41,0,6',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,3,Sede,true,6130,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,4,Aguai,false,0,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,5,Samu,false,0,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,6,Sao Joao,false,0,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,7,Tambau,true,105,0,2',
  'PO Test Multi,8,A,false,0,100,0', 'PO Test Multi,9,B,false,0,200,0', 'PO Test Multi,10,C,false,0,300,0',
].join('\n');
const freqRows = [
  'cliente_nome,unidade_id,unidade_nome,configuracao_frequencia_ativa,qtd_horarios,qtd_jornadas,qtd_solicitacoes,qtd_tratamento_ponto,qtd_colaboradores_registraram_ponto',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,1,Mococa,true,9,58,219,0,137',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,2,Saude,true,6,579,307,0,30',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,3,Sede,true,25,1915,4753,0,530',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,4,Aguai,true,24,23,0,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,5,Samu,true,2,0,0,0,1',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,6,Sao Joao,true,27,25,127,0,142',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,7,Tambau,true,8,131,100,0,39',
  'PO Test Multi,8,A,false,0,0,0,0,100', 'PO Test Multi,9,B,false,0,0,0,0,0', 'PO Test Multi,10,C,false,0,0,0,0,0',
].join('\n');
const healthRows = [
  'cliente_nome,unidade_id,unidade_nome,qtd_medicos,qtd_aso,qtd_atestados',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,1,Mococa,3,0,3',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,2,Saude,20,0,50',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,3,Sede,250,0,849',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,4,Aguai,0,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,5,Samu,0,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,6,Sao Joao,6,0,7',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,7,Tambau,5,0,6',
  'PO Test Multi,8,A,1,1,10', 'PO Test Multi,9,B,2,2,20', 'PO Test Multi,10,C,3,3,43',
].join('\n');
const dpRows = [
  'cliente_nome,unidade_id,unidade_nome,colaboradores_ativos_importacao_true,colaboradores_ativos_importacao_false',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,1,Mococa,137,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,2,Saude,30,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,3,Sede,530,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,4,Aguai,0,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,5,Samu,1,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,6,Sao Joao,142,0',
  'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA,7,Tambau,39,0',
  'PO Test Multi,8,A,100,0', 'PO Test Multi,9,B,900,0', 'PO Test Multi,10,C,0,0',
].join('\n');
const processed = await processFiles([
  { filename: 'clientes.csv', content: csv(customers) },
  { filename: 'Módulo Férias- 31.08.26.csv', content: csv(vacations) },
  { filename: 'Módulo Frequência- 31.08.26.csv', content: csv(freqRows) },
  { filename: 'Módulo Saude Ocuapcional- 31.08.26.csv', content: csv(healthRows) },
  { filename: 'Módulo DP - 31.08.26.csv', content: csv(dpRows) },
]);
const conderg = processed.customers.find((customer) => customer.clienteNome === 'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA')!;
const holiday = conderg.modules.find((module) => module.name === 'Férias')!;
assert.equal(holiday.score, 64);
assert.deepEqual(holiday.indicators.map((indicator) => [indicator.id, indicator.value, indicator.score]), [['vacation-configured', true, 30], ['vacations-imported', 6276, 30], ['vacations-moved-period', 8, 4]]);
assert.equal(holiday.consolidationDetails.find((item) => item.indicator === 'qtd_ferias_via_planilha')?.consolidatedValue, 0);
assert.equal(holiday.indicators.some((indicator) => indicator.id === 'qtd_ferias_via_planilha'), false);
assert.deepEqual(conderg.units.map((unit) => unit.modules.find((module) => module.name === 'Férias')?.indicators.map((indicator) => indicator.value)), [[false, 0, 0], [true, 41, 6], [true, 6130, 0], [false, 0, 0], [false, 0, 0], [false, 0, 0], [true, 105, 2]]);

const freq = conderg.modules.find((module) => module.name === 'Frequência')!;
assert.equal(freq.score, 90);
assert.equal(freq.configuration, 40); assert.equal(freq.configurationMax, 40);
assert.equal(freq.usage, 50); assert.equal(freq.usageMax, 60);
assert.deepEqual(freq.indicators.map((indicator) => [indicator.id, indicator.value, indicator.score]), [['configuration-active', true, 10], ['schedules', 101, 15], ['journeys', 2731, 15], ['point-registrants', '879/879', 30], ['frequency-requests', 5506, 20], ['point-treatment', 0, 0]]);
const blockedPointDetail = freq.consolidationDetails.find((item) => item.indicator === 'qtd_colaboradores_registraram_ponto')!;
assert.equal(blockedPointDetail.rule, 'RECALCULAR');
assert.equal(blockedPointDetail.consolidatedValue, 100);
assert.equal(blockedPointDetail.numerator, 879);
assert.equal(blockedPointDetail.denominator, 879);
assert.equal(freq.indicators.find((indicator) => indicator.id === 'point-registrants')?.score, 30);
assert.equal(conderg.units.find((unit) => unit.unitId === '1')?.modules.find((module) => module.name === 'Frequência')?.indicators.find((indicator) => indicator.id === 'point-registrants')?.rawValue, 137);
assert.equal(conderg.units.find((unit) => unit.unitId === '1')?.modules.find((module) => module.name === 'Frequência')?.indicators.find((indicator) => indicator.id === 'point-registrants')?.score, 30);
assert.notEqual(freq.score, conderg.units.reduce((sum, unit) => sum + unit.modules.find((module) => module.name === 'Frequência')!.score!, 0) / conderg.unitCount);

const healthModule = conderg.modules.find((module) => module.name === 'Saúde Ocupacional')!;
assert.equal(healthModule.score, 60);
assert.deepEqual(healthModule.indicators.map((indicator) => [indicator.id, indicator.value, indicator.score]), [['doctors', 284, 20], ['asos-configured', 0, 0], ['medical-certificates-period', 915, 40]]);
assert.notEqual(healthModule.score, conderg.units.reduce((sum, unit) => sum + unit.modules.find((module) => module.name === 'Saúde Ocupacional')!.score!, 0) / conderg.unitCount);
assert.equal(conderg.modules.length, 18);
assert.equal(conderg.units.every((unit) => unit.modules.length === 18), true);

const poTest = processed.customers.find((customer) => customer.clienteNome === 'PO Test Multi')!;
assert.equal(poTest.modules.find((module) => module.name === 'Férias')?.score, 0, 'via-planilha is not weighted');
const poFrequency = poTest.modules.find((module) => module.name === 'Frequência')!;
assert.equal(poFrequency.indicators.find((indicator) => indicator.id === 'point-registrants')?.value, '100/1000');
assert.equal(poFrequency.indicators.find((indicator) => indicator.id === 'point-registrants')?.score, 3);
assert.equal(poFrequency.consolidationDetails.find((item) => item.indicator === 'qtd_colaboradores_registraram_ponto')?.consolidatedValue, 10);
assert.equal(poTest.units.find((unit) => unit.unitId === '8')?.modules.find((module) => module.name === 'Frequência')?.indicators.find((indicator) => indicator.id === 'point-registrants')?.score, 30, 'unit A uses only its own DP denominator');
assert.equal(poTest.units.find((unit) => unit.unitId === '9')?.modules.find((module) => module.name === 'Frequência')?.indicators.find((indicator) => indicator.id === 'point-registrants')?.score, 0, 'unit B uses only its own DP denominator');
assert.equal(poTest.modules.find((module) => module.name === 'Saúde Ocupacional')?.score, 36);
assert.equal(poTest.overallScore, (0 + poFrequency.score! + 36) / 3);
assert.equal(poTest.overallScore, (poTest.modules.find((module) => module.name === 'Férias')!.score! + poFrequency.score! + poTest.modules.find((module) => module.name === 'Saúde Ocupacional')!.score!) / 3);

const uncontracted = processed.customers.find((customer) => customer.clienteNome === 'CONSORCIO DE DESENV DA REGIAO DE GOVERNO DE SJBVISTA')!;
assert.equal(uncontracted.overallScore, (64 + 90 + 60) / 3, 'overall averages contracted calculated module scores');
console.log('Final closeout tests passed: approved three matrices, shared bands, ANY/SUM, binary point-use, unit isolation, zero/null, contract, 18 modules and overall score');
