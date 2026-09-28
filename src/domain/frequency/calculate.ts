import type { AdoptionClassification, CalculationStatus, FrequencyAdoptionResult, FrequencyIndicatorResult, FrequencyNormalizedData, FrequencySectionResult } from './types.ts';
import { calculateQuantitativeProgress, classifyAdoption } from '../adoption/classification.ts';

export function classifyFrequencyAdoption(score: number | null): AdoptionClassification | null {
  return classifyAdoption(score) as AdoptionClassification | null;
}

const section = (scores: Array<number | null>, maximo: number): FrequencySectionResult => ({
  score: scores.every((score) => score !== null) ? scores.reduce<number>((sum, score) => sum + score!, 0) : null,
  maximo,
  status: scores.every((score) => score !== null) ? 'calculado' : 'dados_insuficientes',
});
const points = (value: number | null, weight: number) => {
  const progress = calculateQuantitativeProgress(value);
  return { progress, score: progress.percentage === null ? null : weight * progress.percentage / 100 };
};
const boolPoints = (value: boolean | null, weight: number) => value === null ? null : value ? weight : 0;
const countIndicator = (id: string, label: string, value: number | null, score: number | null, weight: number): FrequencyIndicatorResult => {
  const progress = calculateQuantitativeProgress(value);
  return { id, label, value, score, maximo: weight, status: value === null ? 'ausente' : 'disponivel', rule: 'faixas progressivas de 5%', reason: value === null ? 'Indicador não disponível na fonte.' : 'Faixa quantitativa progressiva aplicada ao valor observado.', quantitativeProgress: progress };
};

export function calculateFrequencyAdoption(data: FrequencyNormalizedData): FrequencyAdoptionResult {
  if (data.moduleContracted === false) {
    const notApplicable: FrequencySectionResult = { score: null, maximo: 0, status: 'nao_aplicavel' };
    return { modulo: 'Frequência', score: null, status: 'nao_aplicavel', classificacao: 'Não aplicável', configuracao: notApplicable, uso: notApplicable, indicadores: [] };
  }

  const schedules = points(data.schedulesCount, 15);
  const journeys = points(data.journeysCount, 15);
  const requests = points(data.frequencyRequestsCount, 20);
  const treatment = points(data.pointTreatmentCount, 10);
  const denominator = data.activePointEmployeesCount;
  const pointUse = data.pointRegistrantsCount === null || denominator === null || denominator <= 0 ? null : Math.min(1, Math.max(0, data.pointRegistrantsCount / denominator)) * 30;
  const configuration = section([boolPoints(data.configurationActive, 10), schedules.score, journeys.score], 40);
  const usage = section([pointUse, requests.score, treatment.score], 60);
  const complete = configuration.status === 'calculado' && usage.status === 'calculado';
  const score = complete ? configuration.score! + usage.score! : null;
  const registrantStatus = pointUse === null ? 'ausente' : 'disponivel';
  const indicators: FrequencyIndicatorResult[] = [
    { id: 'configuration-active', label: 'Configuração de Frequência ativa', value: data.configurationActive, score: boolPoints(data.configurationActive, 10), maximo: 10, status: data.configurationActive === null ? 'ausente' : 'disponivel', rule: 'Sim = 10; Não = 0', reason: data.configurationActive === null ? 'Indicador não disponível na fonte.' : 'Valor booleano observado.' },
    countIndicator('schedules', 'Horários cadastrados', data.schedulesCount, schedules.score, 15),
    countIndicator('journeys', 'Jornadas cadastradas', data.journeysCount, journeys.score, 15),
    { id: 'point-registrants', label: 'Colaboradores registrando ponto', value: data.pointRegistrantsCount, score: pointUse, maximo: 30, status: registrantStatus, rule: 'cobertura = registrantes / colaboradores ativos DP × 30', reason: pointUse === null ? 'Numerador ausente ou denominador DP ausente, inválido ou igual a zero.' : data.pointRegistrantsCount! > denominator! ? 'Quantidade de colaboradores registrando ponto superior à quantidade de colaboradores ativos identificada no DP. Pontuação limitada a 30; dados originais preservados.' : 'Cobertura calculada com componentes válidos do DP.' },
    countIndicator('frequency-requests', 'Solicitações de Frequência', data.frequencyRequestsCount, requests.score, 20),
    countIndicator('point-treatment', 'Tratamento de ponto', data.pointTreatmentCount, treatment.score, 10),
  ];
  return { modulo: 'Frequência', score, status: complete ? 'calculado' : 'dados_insuficientes', classificacao: classifyFrequencyAdoption(score), configuracao: configuration, uso: usage, indicadores: indicators };
}
