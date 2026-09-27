import assert from 'node:assert/strict';
import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';
import { calculateQuantitativeProgress } from '../src/domain/adoption/classification.ts';
import { adoptionMatrix } from '../src/domain/adoption/matrix.ts';
import { adoptionValue, mapRawIndicator } from '../scripts/ingestion/mapping.mjs';
import { processFiles } from '../scripts/ingestion/core.mjs';
import { findConsolidationRule, loadConsolidationMatrix } from '../scripts/ingestion/consolidation.mjs';

const values = (stocks: unknown, items: unknown, people: unknown) => ({
  'epi-stocks': stocks, 'epi-items': items, 'epi-employees': people,
});
const score = (stocks: unknown, items: unknown, people: unknown, contracted = true) => calculateAdoptionModule('Gestão de EPIs', values(stocks, items, people), contracted);

assert.deepEqual(adoptionMatrix.find((item) => item.name === 'Gestão de EPIs')?.rules.map(({ id, weight }) => [id, weight]), [
  ['epi-stocks', 20], ['epi-items', 30], ['epi-employees', 50],
]);
assert.equal(adoptionMatrix.find((item) => item.name === 'Gestão de EPIs')?.rules.reduce((sum, rule) => sum + rule.weight, 0), 100);

for (const value of [0, 1, 5, 6, 10, 11, 15, 16, 20, 25, 50, 70, 71, 73, 75, 76, 80, 90, 95, 96, 100, 101]) {
  const expectedPercentage = value === 0 ? 0 : Math.min(100, Math.ceil(value / 5) * 5);
  const progress = calculateQuantitativeProgress(value);
  assert.equal(progress.percentage, expectedPercentage, `progress for ${value}`);
  for (const [stocks, items, people, weight, id] of [[value, 0, 0, 20, 'epi-stocks'], [0, value, 0, 30, 'epi-items'], [0, 0, value, 50, 'epi-employees']] as const) {
    const component = score(stocks, items, people).indicators.find((indicator) => indicator.id === id)!;
    assert.equal(component.quantitativeProgress?.percentage, expectedPercentage, `${id} percentage for ${value}`);
    assert.equal(component.contribution, weight * expectedPercentage / 100, `${id} contribution for ${value}`);
  }
}
assert.equal(score(0, 0, 0).score, 0, 'known zeros score 0 and remain calculable');
assert.equal(score(0, 0, 0).status, 'calculado');
assert.equal(score(null, 0, 0).score, null, 'missing required input remains insufficient');
assert.equal(score(0, 0, null).status, 'dados_insuficientes');
assert.equal(score(0, 0, 0, false).status, 'nao_contratado');
assert.equal(score(0, 0, 0, false).score, null);
assert.equal(score(3, 73, 73).indicators[1].quantitativeProgress?.percentage, 75, '73 follows shared 71–75 band');

for (const [field, id] of [['qtd_estoques', 'epi-stocks'], ['qtd_itens_estoque', 'epi-items'], ['qtd_colaboradores_com_epi', 'epi-employees']] as const) {
  assert.equal(mapRawIndicator('Gestão de EPIs', field)?.functionalId, id);
  assert.equal(adoptionValue('Gestão de EPIs', id, 73), 73, 'quantities stay numeric');
}
const consolidationMatrix = loadConsolidationMatrix();
for (const field of ['qtd_estoques', 'qtd_itens_estoque', 'qtd_colaboradores_com_epi']) {
  assert.equal(findConsolidationRule(consolidationMatrix, 'EPI', field)?.rule, 'SOMAR', `${field} is summed by PO decision`);
}

const csv = (value: string) => Buffer.from(value, 'utf8');
const base = [
  'Task Name,6. PLANO: (drop down)',
  'Cliente Exemplo A,QuarkRH Essencial',
  'Cliente Exemplo B,QuarkRH Essencial',
  'Cliente Exemplo C,QuarkRH Essencial',
  'Cliente sem EPI contratado,Frequência Básico',
].join('\n');
const epi = [
  'cliente_nome,unidade_id,unidade_nome,qtd_estoques,qtd_itens_estoque,qtd_colaboradores_com_epi',
  'Cliente Exemplo A,1001,Unidade Exemplo A,0,0,0',
  'Cliente Exemplo A,1002,Cliente Exemplo A,1,100,100',
  'Cliente Exemplo A,1003,Unidade Exemplo C,1,0,0',
  'Cliente Exemplo A,1004,Unidade Exemplo D,1,100,100',
  'Cliente Exemplo B,2001,Cliente Exemplo B,0,0,0',
  'Cliente sem EPI contratado,991,Unidade não contratada,2,10,10',
].join('\n');
const processed = await processFiles([
  { filename: 'clientes.csv', content: csv(base) },
  { filename: 'epi-module.csv', content: csv(epi) },
]);
const customer = processed.customers.find((item) => item.clienteNome === 'Cliente Exemplo A')!;
const epiModule = customer.modules.find((item) => item.name === 'Gestão de EPIs')!;
assert.equal(customer.modules.length, 18);
assert.equal(customer.units.length, 4);
assert.ok(customer.units.every((unit) => unit.modules.length === 18));
assert.equal(epiModule.score, 81, 'Matriz Geral recalculates totals 3/200/200 and is not unit-score average');
assert.deepEqual(epiModule.indicators.map((indicator) => indicator.value), [3, 200, 200]);
assert.deepEqual(epiModule.indicators.map((indicator) => indicator.score), [1, 30, 50]);
assert.notEqual(epiModule.score, (0 + 81 + 75 + 81) / 4);
assert.equal(customer.overallScore, 81, 'EPI counts in overallScore only for contracted/calculable modules');
assert.deepEqual(customer.units.map((unit) => unit.modules.find((item) => item.name === 'Gestão de EPIs')?.score), [0, 81, 1, 81]);
assert.deepEqual(customer.units.map((unit) => unit.modules.find((item) => item.name === 'Gestão de EPIs')?.indicators.map((indicator) => indicator.value)), [[0, 0, 0], [1, 100, 100], [1, 0, 0], [1, 100, 100]]);

const limeira = processed.customers.find((item) => item.clienteNome === 'Cliente Exemplo B')!;
assert.equal(limeira.modules.find((item) => item.name === 'Gestão de EPIs')?.score, 0);
assert.equal(limeira.modules.find((item) => item.name === 'Gestão de EPIs')?.status, 'calculado');
const noEpiData = processed.customers.find((item) => item.clienteNome === 'Cliente Exemplo C')!;
assert.equal(noEpiData.modules.find((item) => item.name === 'Gestão de EPIs')?.status, 'calculado');
const uncontracted = processed.customers.find((item) => item.clienteNome === 'Cliente sem EPI contratado')!;
assert.equal(uncontracted.modules.find((item) => item.name === 'Gestão de EPIs')?.score, null);
assert.equal(uncontracted.overallScore, null, 'non-contracted EPI does not contribute to overallScore');

console.log('EPI adoption tests passed: shared bands, 20/30/50 weights, mapping, SUM, zero/null, unit isolation, contracted plans, 18-module completeness and customer score recalculation');
