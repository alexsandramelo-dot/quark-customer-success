import { classifyAdoption } from '../adoption/classification.ts';
import { formatAdoptionScore } from '../adoption/format.ts';

type UnitAdoptionSource = { displayName: string; overallScore: number | null };

export function unitAdoptionSummaryRows(units: UnitAdoptionSource[]) {
  return units.map((unit) => ({
    unit: unit.displayName,
    adoption: formatAdoptionScore(unit.overallScore),
    classification: classifyAdoption(unit.overallScore) ?? 'Dados insuficientes',
  }));
}
