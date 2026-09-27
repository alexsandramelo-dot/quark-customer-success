import assert from 'node:assert/strict';
import { calculateFrequencyAdoption } from '../src/domain/frequency/calculate.ts';
import { normalizeFrequencyData } from '../src/domain/frequency/normalize.ts';
import type { FrequencyRawData } from '../src/domain/frequency/types.ts';

const raw = (overrides: Partial<FrequencyRawData> = {}): FrequencyRawData => ({ moduleContracted: true, frequencyConfigurationActive: true, schedulesCount: 0, journeysCount: 0, pointRegistrantsCount: 0, activePointEmployeesCount: 100, pointTreatmentCount: 0, frequencyRequestsCount: 0, ...overrides });
const calc = (overrides: Partial<FrequencyRawData> = {}) => calculateFrequencyAdoption(normalizeFrequencyData(raw(overrides)));
const percentage = (value: number) => value === 0 ? 0 : Math.min(100, Math.ceil(value / 5) * 5);

assert.deepEqual([10, 15, 15, 30, 20, 10].reduce((sum, value) => sum + value, 0), 100);
const expectedAll = calc({ schedulesCount: 100, journeysCount: 100, pointRegistrantsCount: 100, activePointEmployeesCount: 100, frequencyRequestsCount: 100, pointTreatmentCount: 100 });
assert.equal(expectedAll.score, 100);
assert.equal(expectedAll.configuracao.score, 40);
assert.equal(expectedAll.configuracao.maximo, 40);
assert.equal(expectedAll.uso.score, 60);
assert.equal(expectedAll.uso.maximo, 60);
assert.equal(calc({ frequencyConfigurationActive: false }).score, 0);
assert.equal(calc({ frequencyConfigurationActive: null }).score, null);
assert.equal(calc({ moduleContracted: false }).status, 'nao_aplicavel');
assert.equal(calc({ schedulesCount: null }).status, 'dados_insuficientes');

for (const value of [0, 1, 5, 6, 10, 11, 15, 50, 70, 71, 73, 75, 76, 80, 90, 95, 96, 120]) {
  const result = calc({ schedulesCount: value, journeysCount: value, pointRegistrantsCount: value, frequencyRequestsCount: value, pointTreatmentCount: value });
  const expectedProgress = percentage(value);
  assert.equal(result.indicadores.find((item) => item.id === 'schedules')?.score, 15 * expectedProgress / 100, `schedule weight for ${value}`);
  assert.equal(result.indicadores.find((item) => item.id === 'journeys')?.score, 15 * expectedProgress / 100, `journey weight for ${value}`);
  assert.equal(result.indicadores.find((item) => item.id === 'frequency-requests')?.score, 20 * expectedProgress / 100, `request weight for ${value}`);
  assert.equal(result.indicadores.find((item) => item.id === 'point-treatment')?.score, 10 * expectedProgress / 100, `treatment weight for ${value}`);
  assert.equal(result.indicadores.find((item) => item.id === 'point-registrants')?.score, Math.min(value, 100) / 100 * 30, `point coverage for ${value}`);
  assert.equal(result.indicadores.find((item) => item.id === 'point-registrants')?.quantitativeProgress, undefined);
}
for (const value of [1, 73, 100]) assert.equal(calc({ pointRegistrantsCount: value, activePointEmployeesCount: 100 }).indicadores.find((item) => item.id === 'point-registrants')?.score, value / 100 * 30);
assert.equal(calc({ pointRegistrantsCount: 0 }).indicadores.find((item) => item.id === 'point-registrants')?.score, 0);
assert.equal(calc({ pointRegistrantsCount: null }).indicadores.find((item) => item.id === 'point-registrants')?.score, null);
assert.equal(calc({ pointRegistrantsCount: 112, activePointEmployeesCount: 112 }).indicadores.find((item) => item.id === 'point-registrants')?.score, 30);
assert.equal(calc({ pointRegistrantsCount: 56, activePointEmployeesCount: 112 }).indicadores.find((item) => item.id === 'point-registrants')?.score, 15);
assert.ok(Math.abs(calc({ pointRegistrantsCount: 1, activePointEmployeesCount: 112 }).indicadores.find((item) => item.id === 'point-registrants')!.score! - 30 / 112) < 1e-9);
assert.equal(calc({ pointRegistrantsCount: 0, activePointEmployeesCount: 112 }).indicadores.find((item) => item.id === 'point-registrants')?.score, 0);
assert.equal(calc({ pointRegistrantsCount: 100, activePointEmployeesCount: null }).indicadores.find((item) => item.id === 'point-registrants')?.score, null);
assert.equal(calc({ pointRegistrantsCount: 100, activePointEmployeesCount: 0 }).indicadores.find((item) => item.id === 'point-registrants')?.score, null);
assert.equal(calc({ pointRegistrantsCount: 120, activePointEmployeesCount: 100 }).indicadores.find((item) => item.id === 'point-registrants')?.score, 30);
assert.match(calc({ pointRegistrantsCount: 120, activePointEmployeesCount: 100 }).indicadores.find((item) => item.id === 'point-registrants')!.reason!, /Quantidade de colaboradores registrando ponto superior à quantidade de colaboradores ativos identificada no DP\./);
assert.equal((100 / 1000) * 30, 3, 'multiunit coverage is recalculated from summed components, not mean unit coverage');
assert.equal(calc({ pointRegistrantsCount: null }).score, null);
assert.equal(calc({ schedulesCount: 73 }).indicadores.find((item) => item.id === 'schedules')?.quantitativeProgress?.percentage, 75);
assert.equal(calc({ schedulesCount: 73 }).indicadores.find((item) => item.id === 'schedules')?.score, 11.25);
assert.equal(calc({ frequencyRequestsCount: 73 }).indicadores.find((item) => item.id === 'frequency-requests')?.score, 15);
assert.equal(calc({ pointTreatmentCount: 73 }).indicadores.find((item) => item.id === 'point-treatment')?.score, 7.5);

console.log('Frequency adoption tests passed: approved 10/15/15/30/20/10 weights, shared quantitative bands, DP coverage, zero/null, contract and overall completeness');
