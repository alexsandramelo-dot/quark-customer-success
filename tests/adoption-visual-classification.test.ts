import assert from 'node:assert/strict';
import { adoptionClassificationBands, classifyAdoption, getAdoptionVisualRange } from '../src/domain/adoption/classification.ts';
import { moduleAvailabilityReason } from '../src/domain/dashboard/moduleAvailability.ts';

assert.equal(classifyAdoption(null), null);
assert.equal(getAdoptionVisualRange(null), null);
for (const score of [0, 30, 60]) {
  assert.deepEqual(getAdoptionVisualRange(score), { label: 'Baixa adoção', min: 0, max: 60, visualState: 'low' });
}
for (const score of [61, 70, 89]) {
  assert.deepEqual(getAdoptionVisualRange(score), { label: 'Boa adoção', min: 61, max: 89, visualState: 'medium' });
}
for (const score of [90, 100]) {
  assert.deepEqual(getAdoptionVisualRange(score), { label: 'Alta adoção', min: 90, max: 100, visualState: 'high' });
}
assert.equal(getAdoptionVisualRange(60)?.visualState, 'low');
assert.equal(getAdoptionVisualRange(61)?.visualState, 'medium');
assert.equal(getAdoptionVisualRange(89)?.visualState, 'medium');
assert.equal(getAdoptionVisualRange(90)?.visualState, 'high');
assert.deepEqual(adoptionClassificationBands.map(({ name, label }) => `${name} — ${label}`), [
  'Baixa adoção — 0% a 60%', 'Boa adoção — 61% a 89%', 'Alta adoção — 90% a 100%',
]);
assert.equal(moduleAvailabilityReason({ score: null, status: 'dados_insuficientes', hasUsageIndicators: true, indicators: [{ id: 'employee-coverage', label: 'Cobertura de colaboradores', status: 'dados_insuficientes', reason: 'Denominador ausente ou inválido.' }] })?.includes('denominador necessário não disponível'), true);
assert.equal(moduleAvailabilityReason({ score: null, contractStatus: 'nao_incluso', status: 'dados_insuficientes' }), 'Não aplicável — módulo não contratado.');
assert.equal(moduleAvailabilityReason({ score: null, status: 'sem_dados_uso', hasUsageIndicators: false }), 'Sem indicadores importados para este módulo.');
assert.equal(moduleAvailabilityReason({ score: null, status: 'dados_insuficientes', hasUsageIndicators: true, indicators: [] })?.includes('nenhum tem mapeamento'), true);

console.log('Adoption visual classification tests passed: null, threshold edges, shared bands and module availability reasons');
