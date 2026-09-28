import assert from 'node:assert/strict';
import { groupModules, moduleAdoptionLabel, moduleUseState, unitAdoptionLabel } from '../src/domain/dashboard/moduleUsage.ts';
import { unitAdoptionSummaryRows } from '../src/domain/dashboard/unitAdoptionReport.ts';

const module = (overrides: Partial<{ contractStatus: string; hasUsageIndicators: boolean; score: number | null; usage: number | null; status: string }> = {}) => ({ contractStatus: 'contratado', hasUsageIndicators: true, score: 0, usage: 0, status: 'calculado', ...overrides });
assert.equal(moduleUseState(module({ usage: 12 })), 'utiliza');
assert.equal(moduleUseState(module({ usage: 0 })), 'zero_conhecido');
assert.equal(moduleUseState(module({ usage: null, score: null, status: 'dados_insuficientes' })), 'parcial');
assert.equal(moduleUseState(module({ hasUsageIndicators: false, usage: null, score: null, status: 'sem_dados_uso' })), 'sem_dado');
assert.equal(moduleAdoptionLabel(module({ score: 0 })), '0%');
assert.equal(moduleAdoptionLabel(module({ score: null })), 'Dados insuficientes');
assert.equal(moduleAdoptionLabel(module({ contractStatus: 'nao_incluso', score: null })), 'Não aplicável');
assert.equal(unitAdoptionLabel('Unidade A', 70), 'Unidade A — Adoção: 70%');
assert.equal(unitAdoptionLabel('Unidade A', 0), 'Unidade A — Adoção: 0%');
assert.equal(unitAdoptionLabel('Unidade A', null), 'Unidade A — Adoção: Dados insuficientes');
assert.deepEqual(unitAdoptionSummaryRows([
  { displayName: 'Unidade Natal', overallScore: 21.5 },
  { displayName: 'Unidade Recife', overallScore: 24.5 },
  { displayName: 'Unidade sem score', overallScore: null },
]), [
  { unit: 'Unidade Natal', adoption: '21,5%', classification: 'Baixa adoção' },
  { unit: 'Unidade Recife', adoption: '24,5%', classification: 'Baixa adoção' },
  { unit: 'Unidade sem score', adoption: 'Dados insuficientes', classification: 'Dados insuficientes' },
], 'Relatório deve preservar scores, classificação e ordem original das unidades.');
assert.deepEqual(unitAdoptionSummaryRows([]), [], 'Cliente sem unidades não recebe linhas adicionais.');
const groups = groupModules([module(), module({ contractStatus: 'nao_incluso', hasUsageIndicators: false, score: null, status: 'sem_dados_uso' })]);
assert.equal(groups.find((item) => item.title === 'Módulos contratados')?.list.length, 1);
assert.equal(groups.find((item) => item.title === 'Módulos não inclusos')?.list.length, 1);
assert.equal(groups.find((item) => item.title === 'Módulos sem indicadores')?.list.length, 1);
console.log('Dashboard module state tests passed: known zero, missing, partial use, contract groups, score labels');
