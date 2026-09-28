export type DataStatus = 'disponivel' | 'ausente' | 'nao_aplicavel';
export type CalculationStatus = 'calculado' | 'dados_insuficientes' | 'nao_aplicavel';
export type AdoptionClassification = 'Alta adoção' | 'Boa adoção' | 'Adoção parcial' | 'Baixa adoção' | 'Não adotado' | 'Não aplicável';

/** Exportação bruta: preserva ausência e não contém score calculado. */
export type FrequencyRawData = {
  moduleContracted: boolean | null;
  frequencyConfigurationActive: boolean | null;
  schedulesCount: number | null;
  journeysCount: number | null;
  pointRegistrantsCount: number | null;
  activePointEmployeesCount: number | null;
  pointTreatmentCount: number | null;
  frequencyRequestsCount: number | null;
};

/** Dados normalizados para a regra, sem dependência do formato da exportação. */
export type FrequencyNormalizedData = {
  moduleContracted: boolean | null;
  configurationActive: boolean | null;
  schedulesCount: number | null;
  journeysCount: number | null;
  pointRegistrantsCount: number | null;
  activePointEmployeesCount: number | null;
  pointTreatmentCount: number | null;
  frequencyRequestsCount: number | null;
};

export type FrequencyIndicatorResult = {
  id: string;
  label: string;
  value: boolean | number | null;
  score: number | null;
  maximo: number;
  status: DataStatus;
  rule?: string;
  reason?: string;
  quantitativeProgress?: import('../adoption/types.ts').QuantitativeProgress;
};

export type FrequencySectionResult = {
  score: number | null;
  maximo: number;
  status: CalculationStatus;
};

export type FrequencyAdoptionResult = {
  modulo: 'Frequência';
  score: number | null;
  status: CalculationStatus;
  classificacao: AdoptionClassification | null;
  configuracao: FrequencySectionResult;
  uso: FrequencySectionResult;
  indicadores: FrequencyIndicatorResult[];
};
