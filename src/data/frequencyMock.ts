import { calculateFrequencyAdoption } from '../domain/frequency/calculate.ts';
import { normalizeFrequencyData } from '../domain/frequency/normalize.ts';
import type { FrequencyAdoptionResult, FrequencyRawData } from '../domain/frequency/types.ts';

/** Entrada MOCK da futura exportação mensal de indicadores de Frequência. */
const frequencyInputs: Record<string, FrequencyRawData> = {
  atlas: { moduleContracted: true, frequencyConfigurationActive: true, schedulesCount: 12, journeysCount: 8, pointRegistrantsCount: 86, activePointEmployeesCount: 100, pointTreatmentCount: 5, frequencyRequestsCount: 24 },
  lumina: { moduleContracted: true, frequencyConfigurationActive: true, schedulesCount: 2, journeysCount: 1, pointRegistrantsCount: 9, activePointEmployeesCount: 20, pointTreatmentCount: 0, frequencyRequestsCount: 0 },
  nexo: { moduleContracted: true, frequencyConfigurationActive: true, schedulesCount: 10, journeysCount: 6, pointRegistrantsCount: 82, activePointEmployeesCount: 100, pointTreatmentCount: 3, frequencyRequestsCount: 18 },
  ponte: { moduleContracted: true, frequencyConfigurationActive: true, schedulesCount: 1, journeysCount: 1, pointRegistrantsCount: 0, activePointEmployeesCount: 10, pointTreatmentCount: 0, frequencyRequestsCount: 0 },
};

export function getFrequencySnapshot(clientId: string): { raw: FrequencyRawData; result: FrequencyAdoptionResult } {
  const raw = frequencyInputs[clientId] ?? { moduleContracted: null, frequencyConfigurationActive: null, schedulesCount: null, journeysCount: null, pointRegistrantsCount: null, activePointEmployeesCount: null, pointTreatmentCount: null, frequencyRequestsCount: null };
  return { raw, result: calculateFrequencyAdoption(normalizeFrequencyData(raw)) };
}
