import { getAdoptionModule } from './matrix.ts';
import type { AdoptionIndicatorResult, AdoptionModuleResult, AdoptionRule } from './types.ts';
import { calculateQuantitativeProgress, classifyAdoption } from './classification.ts';

export { classifyAdoption } from './classification.ts';
const number = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value.replace(',', '.'))) ? Number(value.replace(',', '.')) : null;
const known = (value: unknown) => value !== null && value !== undefined;
const truthy = (value: unknown) => value === true || value === 1 || ['true', 'sim', 'yes', 'ativo'].includes(String(value).toLowerCase());
const contribution = (rule: AdoptionRule, values: Record<string, unknown>): AdoptionIndicatorResult => {
  const componentValues = rule.kind === 'sum' ? (rule.componentIds ?? []).map((id) => number(values[id])) : [];
  const observed = rule.kind === 'sum' ? componentValues.every((value) => value !== null) ? componentValues.reduce<number>((total, value) => total + value!, 0) : null : values[rule.id];
  const contributionRule = rule.kind === 'boolean' ? 'Sim = peso; Não = 0' : rule.kind === 'positive' ? `Valor > 0 = ${rule.weight}; 0 = 0` : 'faixas progressivas de 5%';
  if (rule.kind === 'coverage') {
    const numerator = number(values[rule.numeratorId!]);
    const denominator = number(values[rule.denominatorId!]);
    if (numerator === null || denominator === null || denominator <= 0) return { id: rule.id, label: rule.label, observedValue: numerator === null ? null : `${numerator}/${denominator ?? '—'}`, rule: 'cobertura = numerador / denominador × peso', maxWeight: rule.weight, contribution: null, status: 'dados_insuficientes', reason: 'Denominador ausente ou inválido.', numerator, denominator };
    const ratio = Math.min(1, Math.max(0, numerator / denominator));
    const overLimit = numerator > denominator;
    return { id: rule.id, label: rule.label, observedValue: `${numerator}/${denominator}`, rule: 'cobertura = numerador / denominador × peso', maxWeight: rule.weight, contribution: ratio * rule.weight, status: 'disponivel', reason: overLimit ? `${rule.overLimitReason ?? 'Numerador superior ao denominador.'} Pontuação limitada ao peso máximo; dados originais preservados.` : 'Calculado com denominador válido.', numerator, denominator };
  }
  if (!known(observed)) return { id: rule.id, label: rule.label, observedValue: null, rule: contributionRule, maxWeight: rule.weight, contribution: null, status: rule.kind === 'sum' ? 'dados_insuficientes' : 'ausente', reason: rule.kind === 'sum' ? 'Não foi possível consolidar com segurança todos os componentes.' : 'Indicador não disponível na fonte.', ...(rule.kind === 'count' || rule.kind === 'sum' ? { quantitativeProgress: calculateQuantitativeProgress(null) } : {}) };
  if (rule.kind === 'boolean') return { id: rule.id, label: rule.label, observedValue: observed, rule: contributionRule, maxWeight: rule.weight, contribution: truthy(observed) ? rule.weight : 0, status: 'disponivel', reason: 'Valor observado.' };
  if (rule.kind === 'positive') {
    const observedNumber = number(observed);
    if (observedNumber === null || observedNumber < 0) return { id: rule.id, label: rule.label, observedValue: observed, rule: contributionRule, maxWeight: rule.weight, contribution: null, status: 'dados_insuficientes', reason: 'Quantidade ausente ou inválida.' };
    return { id: rule.id, label: rule.label, observedValue: observedNumber, rule: contributionRule, maxWeight: rule.weight, contribution: observedNumber > 0 ? rule.weight : 0, status: 'disponivel', reason: observedNumber > 0 ? 'Quantidade positiva observada.' : 'Zero conhecido.' };
  }
  const quantitativeProgress = calculateQuantitativeProgress(number(observed));
  const contributionPoints = quantitativeProgress.percentage === null ? null : rule.weight * quantitativeProgress.percentage / 100;
  const reason = rule.kind === 'sum' ? `Total calculado pela soma dos componentes conhecidos: ${(rule.componentIds ?? []).join(' + ')}.` : 'Pontuação progressiva aplicada ao valor quantitativo.';
  return { id: rule.id, label: rule.label, observedValue: observed, rule: contributionRule, maxWeight: rule.weight, contribution: contributionPoints, status: quantitativeProgress.status, reason, quantitativeProgress };
};

export function calculateAdoptionModule(moduleName: string, values: Record<string, unknown>, contracted = true): AdoptionModuleResult { const matrix = getAdoptionModule(moduleName); if (!matrix) throw new Error(`Módulo sem matriz: ${moduleName}`); const maxBySection = (name: 'configuracao' | 'ativacao' | 'uso') => matrix.rules.filter((rule) => rule.section === name).reduce((sum, rule) => sum + rule.weight, 0); if (!contracted) return { module: moduleName, temporalType: matrix.temporalType, score: null, status: 'nao_contratado', classification: null, configuration: { score: null, max: maxBySection('configuracao'), status: 'nao_contratado' }, activation: { score: null, max: maxBySection('ativacao'), status: 'nao_contratado' }, usage: { score: null, max: maxBySection('uso'), status: 'nao_contratado' }, indicators: [] }; const indicators = matrix.rules.map((rule) => contribution(rule, values)); const section = (name: 'configuracao' | 'ativacao' | 'uso') => { const valuesInSection = indicators.filter((indicator) => matrix.rules.find((rule) => rule.id === indicator.id)?.section === name); const complete = valuesInSection.every((indicator) => indicator.contribution !== null); const max = maxBySection(name); return { score: complete ? valuesInSection.reduce((sum, indicator) => sum + indicator.contribution!, 0) : null, max, status: complete ? 'calculado' as const : 'dados_insuficientes' as const }; }; const configuration = section('configuracao'); const activation = section('ativacao'); const usage = section('uso'); const complete = indicators.every((indicator) => indicator.contribution !== null); const score = complete ? configuration.score! + activation.score! + usage.score! : null; return { module: moduleName, temporalType: matrix.temporalType, score, status: complete ? 'calculado' : 'dados_insuficientes', classification: classifyAdoption(score), configuration, activation, usage, indicators }; }
