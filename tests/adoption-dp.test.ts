import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';
import { mapRawIndicator } from '../scripts/ingestion/mapping.mjs';
import { adoptionMatrix } from '../src/domain/adoption/matrix.ts';

const full = (overrides: Record<string, unknown> = {}) => ({
  'employees-imported': 0, 'employees-direct': 0,
  'company-configured': true, sectors: 96, positions: 96,
  'document-model': 96, 'experience-evaluation': true, ...overrides,
});
const employeeRow = (overrides: Record<string, unknown> = {}) => calculateAdoptionModule('Departamento Pessoal', full(overrides)).indicators.find((indicator) => indicator.id === 'employees-total')!;
const employee = (imported: unknown, direct: unknown) => employeeRow({'employees-imported': imported, 'employees-direct': direct});

for (const [imported, direct, total, points] of [[50, 200, 250, 30], [0, 20, 20, 6], [0, 0, 0, 0], [0, 24, 24, 7.5], [96, 0, 96, 30], [500, 0, 500, 30]] as const) {
  const actual = employee(imported, direct);
  if (actual.observedValue !== total || actual.contribution !== points) throw new Error(`DP employee sum/scoring mismatch for ${imported}+${direct}: ${actual.observedValue}/${actual.contribution}`);
}
const absent = employee(null, null);
if (absent.contribution !== null || absent.observedValue !== null || absent.status !== 'dados_insuficientes') throw new Error('Null employee inputs must remain insufficient, not zero');
const multiUnit = employee(250, 250);
if (multiUnit.observedValue !== 500 || multiUnit.contribution !== 30) throw new Error('Consolidated employee quantities must be summed before scoring');
const partial = employee(null, 250);
if (partial.observedValue !== null || partial.contribution !== null) throw new Error('A missing required employee component must not become zero');
const dpMax = calculateAdoptionModule('Departamento Pessoal', full({'employees-imported': 500}));
if (dpMax.score !== 100 || dpMax.indicators.find((indicator) => indicator.id === 'employees-total')?.contribution !== 30) throw new Error('DP score must be capped at 100');
if (calculateAdoptionModule('Departamento Pessoal', full(), false).status !== 'nao_contratado') throw new Error('Non-contracted DP scored');
const dpMatrix = adoptionMatrix.find((module) => module.name === 'Departamento Pessoal')!;
if (dpMatrix.rules.reduce((total, rule) => total + rule.weight, 0) !== 100) throw new Error('DP rules must total 100');
if (dpMatrix.rules.find((rule) => rule.id === 'employees-total')?.kind !== 'sum') throw new Error('Employee score must use quantitative SUM');
for (const [id, field] of [['company-configured','dados_empresa_preenchidos'],['sectors','qtd_setores'],['positions','qtd_cargos'],['document-model','qtd_modelos_documentos'],['experience-evaluation','avaliacao_experiencia_configurada'],['employees-imported','colaboradores_ativos_importacao_true'],['employees-direct','colaboradores_ativos_importacao_false']]) {
  if (mapRawIndicator('Departamento Pessoal', field)?.functionalId !== id) throw new Error(`Real DP field not mapped: ${field}`);
}
for (const id of ['company-configured','experience-evaluation']) {
  if (calculateAdoptionModule('Departamento Pessoal', full({[id]:false})).indicators.find((indicator) => indicator.id === id)?.contribution !== 0) throw new Error(`${id}=false must score zero`);
  const absentValues = full(); delete absentValues[id];
  if (calculateAdoptionModule('Departamento Pessoal', absentValues).score !== null) throw new Error(`${id}=missing must remain insufficient`);
}
const vacation = calculateAdoptionModule('Férias', {'vacation-configured':true,'vacations-imported':24,'vacations-moved-period':96});
if (vacation.score !== 77.5) throw new Error('Férias regression');
console.log('DP adoption tests passed: quantitative sum, progressive bands, zero/null, max 100, contract and vacation regression');
