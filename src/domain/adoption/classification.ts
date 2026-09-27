export type AdoptionClassificationBand = {
  name: 'Baixa adoção' | 'Boa adoção' | 'Alta adoção';
  min: number;
  max: number;
  label: string;
  visualState: 'low' | 'medium' | 'high';
};

export const adoptionClassificationBands: AdoptionClassificationBand[] = [
  { name: 'Baixa adoção', min: 0, max: 60, label: '0% a 60%', visualState: 'low' },
  { name: 'Boa adoção', min: 61, max: 89, label: '61% a 89%', visualState: 'medium' },
  { name: 'Alta adoção', min: 90, max: 100, label: '90% a 100%', visualState: 'high' },
];

export function classifyAdoption(score: number | null) {
  if (score === null || !Number.isFinite(score)) return null;
  return getAdoptionVisualRange(score)?.label ?? null;
}

export function getAdoptionVisualRange(score: number | null) {
  if (score === null || !Number.isFinite(score)) return null;
  const visualBand = score <= 60 ? adoptionClassificationBands[0] : score < 90 ? adoptionClassificationBands[1] : score <= 100 ? adoptionClassificationBands[2] : null;
  return visualBand ? { label: visualBand.name, min: visualBand.min, max: visualBand.max, visualState: visualBand.visualState } : null;
}

export type QuantitativeProgress = { value: number | null; range: string | null; min: number | null; max: number | null; percentage: number | null; status: 'disponivel' | 'dados_insuficientes' };

export function calculateQuantitativeProgress(value: number | null): QuantitativeProgress {
  if (value === null || !Number.isFinite(value) || value < 0) return { value, range: null, min: null, max: null, percentage: null, status: 'dados_insuficientes' };
  if (value === 0) return { value, range: '0', min: 0, max: 0, percentage: 0, status: 'disponivel' };
  const percentage = Math.min(100, Math.ceil(value / 5) * 5);
  const min = Math.max(1, percentage - 4);
  const max = percentage;
  return { value, range: value >= 96 ? '96+' : `${min}–${max}`, min, max: value >= 96 ? null : max, percentage, status: 'disponivel' };
}
