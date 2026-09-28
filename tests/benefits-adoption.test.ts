import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';
import { mapRawIndicator, adoptionValue } from '../scripts/ingestion/mapping.mjs';
import { consolidateIndicator, findConsolidationRule, loadConsolidationMatrix } from '../scripts/ingestion/consolidation.mjs';
import { processFiles } from '../scripts/ingestion/core.mjs';

const score = (vt: unknown, va: unknown, people: unknown, contracted = true) => calculateAdoptionModule('Benefícios', {
  'transport-voucher': vt, 'meal-voucher': va, 'linked-employees': people,
}, contracted);

for (const [value, expected] of [[0, 0], [1, 25], [2, 25]] as const) {
  if (score(value, 0, 0).indicators[0].contribution !== expected) throw new Error(`VT ${value} contribution mismatch`);
  if (score(0, value, 0).indicators[1].contribution !== expected) throw new Error(`VA ${value} contribution mismatch`);
}
for (const [people, expected] of [[0, 0], [1, 2.5], [5, 2.5], [6, 5], [15, 7.5], [16, 10], [24, 12.5], [50, 25], [70, 35], [71, 37.5], [73, 37.5], [75, 37.5], [76, 40], [80, 40], [95, 47.5], [96, 50], [120, 50]] as const) {
  const result = score(0, 0, people);
  if (result.indicators[2].contribution !== expected) throw new Error(`Linked employees ${people}: expected ${expected}, got ${result.indicators[2].contribution}`);
}
const allZero = score(0, 0, 0);
if (allZero.score !== 0 || allZero.status !== 'calculado') throw new Error('Known all-zero Benefits must calculate as 0');
const full = score(4, 5, 100);
if (full.score !== 100 || full.indicators[0].observedValue !== 4 || full.indicators[1].observedValue !== 5) throw new Error('Synthetic consolidated values must score 100 and retain raw counts');
const rdt = score(3, 1, 73);
if (rdt.score !== 87.5 || rdt.classification !== 'Boa adoção' || rdt.indicators[2].quantitativeProgress?.percentage !== 75) throw new Error('Synthetic client with 73 employees must follow the 71–75 band: 87.5/100, Boa adoção');
if (score(null, 0, 0).score !== null || score(0, null, 0).score !== null || score(0, 0, null).score !== null) throw new Error('Null required components must remain insufficient');
if (score(0, 0, 0, false).score !== null || score(0, 0, 0, false).status !== 'nao_contratado') throw new Error('Non-contracted Benefits must not score');

for (const [field, id] of [['qtd_beneficios_vt', 'transport-voucher'], ['qtd_beneficios_va', 'meal-voucher'], ['qtd_colaboradores_com_beneficio', 'linked-employees']] as const) {
  if (mapRawIndicator('Benefícios', field)?.functionalId !== id) throw new Error(`Missing Benefits mapping for ${field}`);
}
if (adoptionValue('Benefícios', 'transport-voucher', 4) !== 4) throw new Error('VT quantity must remain numeric for explanation');
if (adoptionValue('Benefícios', 'meal-voucher', 1) !== 1) throw new Error('VA quantity must remain numeric for explanation');

const matrix = loadConsolidationMatrix();
const sumAll = (values: number[]) => consolidateIndicator('SOMAR', values.map((value, index) => ({ unitId: String(index), value })));
const consolidatedVt = sumAll([0, 2]);
const consolidatedVa = sumAll([0, 1]);
const consolidatedPeople = sumAll([100, 80]);
const recomputed = score(consolidatedVt.value, consolidatedVa.value, consolidatedPeople.value);
const unitA = score(0, 0, 100);
const unitB = score(2, 1, 80);
if (consolidatedVt.value !== 2 || consolidatedVa.value !== 1 || consolidatedPeople.value !== 180) throw new Error('PO-approved multi-unit values must be summed');
if (recomputed.score !== 100 || unitA.score !== 50 || unitB.score !== 90) throw new Error('Consolidated score must be recalculated from summed values, not averaged unit scores');
if (findConsolidationRule(matrix, 'Benefícios', 'qtd_colaboradores_com_beneficio')?.rule !== 'SOMAR') throw new Error('Benefits employee consolidation must follow PO SUM rule');

const csv = (value: string) => Buffer.from(value, 'utf8');
const integrated = await processFiles([
  { filename: 'clientes.csv', content: csv('Task Name,6. PLANO: (drop down)\nCliente Contratado,QuarkRH Essencial\nCliente Sem Beneficios,Frequência Básico\n') },
  { filename: 'beneficios.csv', content: csv('cliente_nome,unidade_id,unidade_nome,qtd_beneficios_vt,qtd_beneficios_va,qtd_colaboradores_com_beneficio\nCliente Contratado,10,Natal,0,0,100\nCliente Contratado,20,Recife,2,1,80\nCliente Sem Beneficios,30,Unidade X,1,1,0\n') },
]);
const contractedCustomer = integrated.customers.find((customer) => customer.clienteNome === 'Cliente Contratado')!;
const contractedBenefits = contractedCustomer.modules.find((module) => module.name === 'Benefícios')!;
if (contractedCustomer.modules.length !== 18 || contractedBenefits.score !== 100 || contractedCustomer.overallScore !== 100) throw new Error('Contracted Benefits must be included in overallScore after summing source indicators');
if (contractedBenefits.indicators.find((item) => item.id === 'linked-employees')?.value !== 180) throw new Error('Consolidated headcount must sum units before scoring');
if (contractedCustomer.units.find((unit) => unit.unitId === '10')?.modules.find((module) => module.name === 'Benefícios')?.score !== 50) throw new Error('Unit A must keep its own Benefits indicators');
if (contractedCustomer.units.find((unit) => unit.unitId === '20')?.modules.find((module) => module.name === 'Benefícios')?.score !== 90) throw new Error('Unit B must keep its own Benefits indicators');
if (contractedBenefits.score === ((50 + 90) / 2)) throw new Error('Customer Benefits score must not average unit scores');
const nonContractCustomer = integrated.customers.find((customer) => customer.clienteNome === 'Cliente Sem Beneficios')!;
if (nonContractCustomer.modules.find((module) => module.name === 'Benefícios')?.score !== null || nonContractCustomer.overallScore !== null) throw new Error('Non-contracted Benefits must remain out of overallScore');

console.log('Benefits adoption tests passed: all component boundaries, zero/null, retained counts, SUM, isolated unit scores and contract');
