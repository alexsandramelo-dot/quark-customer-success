import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';
import { adoptionMatrix } from '../src/domain/adoption/matrix.ts';
import { mapRawIndicator } from '../scripts/ingestion/mapping.mjs';

const cases = [
  ['Folha', { 'payroll-configured': true, 'payroll-items': 24, 'payroll-created-history': 96 }],
  ['Frequência', { 'configuration-active': true, schedules: 24, journeys: 1, 'point-registrants': 1, 'active-point-employees': 10, 'point-treatment': 24, 'frequency-requests': 96 }],
  ['Assinatura Eletrônica', { 'first-document': '2026-08-01', 'documents-total': 24, 'documents-90-days': 24, 'documents-finalized-90-days': 96, 'active-unit-90-days': true }],
  ['T&D', { 'active-course': 24, 'active-modules': 1, 'active-enrollments': 24, 'active-enrollments-90-days': 1, 'student-progress': 96 }],
  ['Saúde Ocupacional', { doctors: 24, 'asos-configured': 24, 'medical-certificates-period': 96 }],
  ['Avaliação de Desempenho', { 'scales-configured': 24, 'evaluation-process': 24, 'evaluations-answered': 96 }],
  ['Perfil Comportamental', { 'disc-configured': true, 'tests-answered': 96 }],
  ['Comunicação', { 'communications-or-surveys': 24, 'published-content': 24, 'surveys-answered-period': 96 }],
  ['Pesquisa de Clima', { 'climate-survey-created': 24, responses: 96 }],
  ['Feedbacks', { 'feedback-configured': true, 'praise-types': 24, 'praises-history': 24, 'feedbacks-history': 96 }],
  ['Recrutamento e Seleção', { 'jobs-portal': true, 'selection-stages': 24, candidates: 96 }],
];
for (const [name, values] of cases) {
  const matrix = adoptionMatrix.find((item) => item.name === name)!;
  if (matrix.rules.reduce((sum, rule) => sum + rule.weight, 0) !== 100) throw new Error(`${name} weights do not total 100`);
  const result = calculateAdoptionModule(name, values);
  if (result.status !== 'calculado' || result.score === null) throw new Error(`${name} did not calculate`);
  const zeroValues = Object.fromEntries(matrix.rules.map((rule) => [rule.id, rule.kind === 'boolean' ? false : 0]));
  if (name === 'Frequência') zeroValues['active-point-employees'] = 10;
  const zero = calculateAdoptionModule(name, zeroValues);
  if (zero.status !== 'calculado' || zero.score !== 0) throw new Error(`${name} did not preserve known zero`);
  const missing = calculateAdoptionModule(name, Object.fromEntries(matrix.rules.slice(1).map((rule) => [rule.id, rule.kind === 'boolean' ? true : 1])));
  if (missing.status !== 'dados_insuficientes' || missing.score !== null) throw new Error(`${name} did not preserve missing value`);
  if (calculateAdoptionModule(name, values, false).status !== 'nao_contratado') throw new Error(`${name} scored a non-contracted module`);
}
const expectedAliases = [
  ['T&D', 'qtd_matriculas_ativas'], ['Comunicação', 'qtd_comunicados'], ['Feedbacks', 'qtd_feedbacks'],
  ['Recrutamento e Seleção', 'qtd_inscritos'], ['Folha', 'qtd_folhas'], ['Frequência', 'qtd_tratamento_ponto'],
  ['Avaliação de Desempenho', 'qtd_resultados_avaliacao'], ['Perfil Comportamental', 'qtd_respostas'],
  ['Pesquisa de Clima', 'qtd_respostas_questionario'], ['Saúde Ocupacional', 'qtd_atestados'],
  ['Assinatura Eletrônica', 'qtd_documentos_90_dias'],
];
for (const [module, raw] of expectedAliases) if (!mapRawIndicator(module, raw)) throw new Error(`Missing real alias: ${module}/${raw}`);
const oldVacation = calculateAdoptionModule('Férias', { 'vacation-configured': true, 'vacations-imported': 24, 'vacations-moved-period': 96 });
if (oldVacation.score !== 77.5 || oldVacation.status !== 'calculado') throw new Error(`Vacation regression: ${oldVacation.score}`);
const frequency = cases.find(([name]) => name === 'Frequência')!;
const oneUnitScore = calculateAdoptionModule('Frequência', frequency[1]).score!;
const threeUnitConsolidated = calculateAdoptionModule('Frequência', { 'configuration-active': true, schedules: 48, journeys: 3, 'point-registrants': 100, 'active-point-employees': 1000, 'point-treatment': 24, 'frequency-requests': 96 }).score!;
if (threeUnitConsolidated === oneUnitScore) throw new Error('Multi-unit consolidated indicators did not change module score');
console.log(`Real adoption matrix tests passed: ${cases.length} modules, weights, zero/null, contract, aliases and vacation regression`);
