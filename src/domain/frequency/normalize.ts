import type { FrequencyNormalizedData, FrequencyRawData } from './types.ts';

export function normalizeFrequencyData(raw: FrequencyRawData): FrequencyNormalizedData {
  return {
    moduleContracted: raw.moduleContracted,
    configurationActive: raw.frequencyConfigurationActive,
    schedulesCount: raw.schedulesCount,
    journeysCount: raw.journeysCount,
    pointRegistrantsCount: raw.pointRegistrantsCount,
    activePointEmployeesCount: raw.activePointEmployeesCount,
    pointTreatmentCount: raw.pointTreatmentCount,
    frequencyRequestsCount: raw.frequencyRequestsCount,
  };
}
