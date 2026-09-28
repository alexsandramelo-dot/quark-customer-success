import assert from 'node:assert/strict';
import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';
import { adoptionClassificationBands, calculateQuantitativeProgress } from '../src/domain/adoption/classification.ts';
import { consolidateIndicator } from '../scripts/ingestion/consolidation.mjs';

const cases: Array<[number | null, number | null, string | null]> = [
  [null, null, null], [0, 0, '0'], [1, 5, '1–5'], [5, 5, '1–5'], [6, 10, '6–10'], [10, 10, '6–10'], [11, 15, '11–15'], [15, 15, '11–15'], [16, 20, '16–20'], [20, 20, '16–20'], [25, 25, '21–25'], [30, 30, '26–30'], [35, 35, '31–35'], [40, 40, '36–40'], [45, 45, '41–45'], [50, 50, '46–50'], [55, 55, '51–55'], [60, 60, '56–60'], [65, 65, '61–65'], [70, 70, '66–70'], [75, 75, '71–75'], [80, 80, '76–80'], [85, 85, '81–85'], [90, 90, '86–90'], [95, 95, '91–95'], [96, 100, '96+'], [100, 100, '96+'], [131, 100, '96+'],
];
for (const [value, percentage, range] of cases) {
  const actual = calculateQuantitativeProgress(value);
  assert.equal(actual.percentage, percentage, `percentage for ${value}`);
  assert.equal(actual.range, range, `range for ${value}`);
  assert.equal(actual.status, value === null ? 'dados_insuficientes' : 'disponivel');
}
for (const [value, expected] of [[0, 0], [5, 1.5], [10, 3], [15, 4.5], [25, 7.5], [50, 15], [95, 28.5], [96, 30], [131, 30]] as const) {
  const module = calculateAdoptionModule('Férias', { 'vacation-configured': true, 'vacations-imported': value, 'vacations-moved-period': 0 });
  assert.equal(module.indicators.find((indicator) => indicator.id === 'vacations-imported')?.contribution, expected);
  assert.ok(module.indicators.every((indicator) => indicator.contribution === null || indicator.contribution <= indicator.maxWeight));
}
assert.deepEqual(adoptionClassificationBands.map(({ name, label }) => [name, label]), [
  ['Baixa adoção', '0% a 60%'], ['Boa adoção', '61% a 89%'], ['Alta adoção', '90% a 100%'],
]);

const consolidated = consolidateIndicator('SOMAR', [{ unitId: 'A', value: 4 }, { unitId: 'B', value: 7 }]);
assert.equal(consolidated.value, 11);
const scored = calculateAdoptionModule('Férias', { 'vacation-configured': true, 'vacations-imported': consolidated.value, 'vacations-moved-period': 0 });
assert.equal(scored.indicators.find((indicator) => indicator.id === 'vacations-imported')?.quantitativeProgress?.range, '11–15');
assert.equal(scored.indicators.find((indicator) => indicator.id === 'vacations-imported')?.contribution, 4.5);
assert.equal(scored.score, 34.5);
assert.notEqual(scored.score, (calculateAdoptionModule('Férias', { 'vacation-configured': true, 'vacations-imported': 4, 'vacations-moved-period': 0 }).score! + calculateAdoptionModule('Férias', { 'vacation-configured': true, 'vacations-imported': 7, 'vacations-moved-period': 0 }).score!) / 2);
console.log(`Quantitative adoption tests passed: ${cases.length} boundaries, weighted points, classification bands, and multi-unit consolidation`);
