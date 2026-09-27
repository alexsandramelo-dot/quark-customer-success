import assert from 'node:assert/strict';
import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';
import { calculateQuantitativeProgress } from '../src/domain/adoption/classification.ts';
import { adoptionMatrix } from '../src/domain/adoption/matrix.ts';
import { mapRawIndicator } from '../scripts/ingestion/mapping.mjs';
import { consolidateIndicator, findConsolidationRule, loadConsolidationMatrix } from '../scripts/ingestion/consolidation.mjs';
import { processFiles } from '../scripts/ingestion/core.mjs';

const score = (configured: unknown, rubrics: unknown, payrolls: unknown, contracted = true) => calculateAdoptionModule('Folha', {
  'payroll-configured': configured, 'payroll-items': rubrics, 'payroll-created-history': payrolls,
}, contracted);

const matrix = adoptionMatrix.find((item) => item.name === 'Folha')!;
assert.deepEqual(matrix.rules.map(({ id, weight }) => [id, weight]), [
  ['payroll-configured', 30], ['payroll-items', 30], ['payroll-created-history', 40],
]);
assert.equal(matrix.rules.reduce((sum, rule) => sum + rule.weight, 0), 100);
assert.equal(score(true, 100, 73).score, 90, 'approved example: 30 + 30 + 30 = 90');
assert.equal(score(false, 0, 0).score, 0, 'false and known zero values calculate as zero');
assert.equal(score(null, 0, 0).score, null, 'null integration remains insufficient');
assert.equal(score(true, 0, null).status, 'dados_insuficientes');
assert.equal(score(true, 73, 73).indicators[1].quantitativeProgress?.percentage, 75);
assert.equal(score(true, 73, 73).indicators[2].quantitativeProgress?.percentage, 75);
assert.equal(score(true, 73, 73).indicators[1].contribution, 22.5);
assert.equal(score(true, 73, 73).indicators[2].contribution, 30);
assert.equal(score(true, 96, 96).score, 100, 'counts >=96 reach their component maximum');
assert.equal(score(true, 73, 73, false).status, 'nao_contratado');

for (const quantity of [0, 1, 5, 6, 10, 11, 15, 50, 70, 71, 73, 75, 76, 80, 90, 95, 96, 97, 120]) {
  const expected = quantity === 0 ? 0 : Math.min(100, Math.ceil(quantity / 5) * 5);
  assert.equal(calculateQuantitativeProgress(quantity).percentage, expected, `progress for ${quantity}`);
  const result = score(false, quantity, quantity);
  const rubric = result.indicators.find((item) => item.id === 'payroll-items')!;
  const payrolls = result.indicators.find((item) => item.id === 'payroll-created-history')!;
  assert.equal(rubric.quantitativeProgress?.percentage, expected);
  assert.equal(rubric.contribution, 30 * expected / 100);
  assert.equal(payrolls.quantitativeProgress?.percentage, expected);
  assert.equal(payrolls.contribution, 40 * expected / 100);
}

for (const [field, id] of [['configuracao_integracao_contabil_ativa', 'payroll-configured'], ['qtd_rubricas', 'payroll-items'], ['qtd_folhas', 'payroll-created-history']] as const) {
  assert.equal(mapRawIndicator('Folha de Pagamento', field)?.functionalId, id);
}
const consolidation = loadConsolidationMatrix();
assert.equal(findConsolidationRule(consolidation, 'Folha de Pagamento', 'configuracao_integracao_contabil_ativa')?.rule, 'ANY');
assert.equal(findConsolidationRule(consolidation, 'Folha de Pagamento', 'qtd_rubricas')?.rule, 'SOMAR');
assert.equal(findConsolidationRule(consolidation, 'Folha de Pagamento', 'qtd_folhas')?.rule, 'SOMAR');
const any = (values: Array<boolean | null>) => consolidateIndicator('ANY (se regra funcional = cliente usa)', values.map((value, index) => ({ unitId: String(index), value })));
assert.equal(any([true, false]).value, true);
assert.equal(any([false, false]).value, false);
assert.equal(any([false, null]).value, null, 'missing units are not converted to false');
assert.equal(any([true, null]).value, true, 'retain existing ANY semantics');

const csv = (value: string) => Buffer.from(value, 'utf8');
const customers = [
  'Task Name,6. PLANO: (drop down)',
  'Folha Multi,QuarkRH Essencial',
  'Folha Uma Unidade,QuarkRH Essencial',
  'Folha Fora do Plano,Frequência Básico',
].join('\n');
const payrollData = [
  'cliente_nome,unidade_id,unidade_nome,configuracao_integracao_contabil_ativa,qtd_rubricas,qtd_folhas',
  'Folha Multi,10,Natal,true,3,12',
  'Folha Multi,20,Recife,false,73,73',
  'Folha Uma Unidade,30,Fortaleza,true,73,73',
  'Folha Fora do Plano,40,Unidade X,true,3,12',
].join('\n');
const processed = await processFiles([
  { filename: 'clientes.csv', content: csv(customers) },
  { filename: 'Módulo Folha Pagamento - 31.08.26.csv', content: csv(payrollData) },
]);
const multi = processed.customers.find((customer) => customer.clienteNome === 'Folha Multi')!;
const multiModule = multi.modules.find((item) => item.name === 'Folha')!;
assert.equal(multi.modules.length, 18);
assert.equal(multiModule.score, 88, 'ANY true, rubrics 76 and payrolls 85 are scored after consolidation');
assert.equal(multiModule.indicators.find((item) => item.id === 'payroll-configured')?.value, true);
assert.equal(multiModule.indicators.find((item) => item.id === 'payroll-items')?.value, 76);
assert.equal(multiModule.indicators.find((item) => item.id === 'payroll-created-history')?.value, 85);
assert.equal(multiModule.indicators.find((item) => item.id === 'payroll-items')?.score, 24);
assert.equal(multiModule.indicators.find((item) => item.id === 'payroll-created-history')?.score, 34);
assert.notEqual(multiModule.score, (37.5 + 52.5) / 2, 'customer score is not an average of unit scores');
assert.equal(multi.overallScore, 88);
assert.deepEqual(multi.units.map((unit) => unit.modules.find((item) => item.name === 'Folha')?.score), [37.5, 52.5]);
assert.deepEqual(multi.units.map((unit) => unit.modules.find((item) => item.name === 'Folha')?.indicators.map((item) => item.value)), [[true, 3, 12], [false, 73, 73]]);

const single = processed.customers.find((customer) => customer.clienteNome === 'Folha Uma Unidade')!;
const singleModule = single.modules.find((item) => item.name === 'Folha')!;
assert.equal(single.unitCount, 1);
assert.equal(singleModule.score, 82.5);
assert.deepEqual(singleModule.indicators.map((item) => item.value), [true, 73, 73]);
assert.equal(single.overallScore, 82.5);
const notContracted = processed.customers.find((customer) => customer.clienteNome === 'Folha Fora do Plano')!;
assert.equal(notContracted.modules.find((item) => item.name === 'Folha')?.score, null);
assert.equal(notContracted.overallScore, null, 'non-contracted payroll is excluded from overallScore');

console.log('Payroll adoption tests passed: official 30/30/40 matrix, shared bands, ANY, SUM, zero/null, one/multi-unit, score-after-consolidation, unit isolation, contract and overallScore');
