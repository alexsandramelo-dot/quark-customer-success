export type TemporalType = 'CONTÍNUO' | 'PERIÓDICO' | 'SAZONAL' | 'CONTÍNUO / PERIÓDICO' | 'PERIÓDICO / SAZONAL';
export type AdoptionStatus = 'calculado' | 'dados_insuficientes' | 'nao_aplicavel' | 'nao_contratado' | 'plano_indeterminado' | 'plano_nao_mapeado';
export type RuleSection = 'configuracao' | 'ativacao' | 'uso';
export type RuleKind = 'boolean' | 'positive' | 'count' | 'coverage' | 'sum';

export type AdoptionRule = {
  id: string;
  label: string;
  section: RuleSection;
  kind: RuleKind;
  weight: number;
  numeratorId?: string;
  denominatorId?: string;
  componentIds?: string[];
  overLimitReason?: string;
};

export type QuantitativeProgress = { value: number | null; range: string | null; min: number | null; max: number | null; percentage: number | null; status: 'disponivel' | 'dados_insuficientes' };

export type AdoptionModuleMatrix = {
  name: string;
  temporalType: TemporalType;
  rules: AdoptionRule[];
};

export type AdoptionIndicatorResult = {
  id: string;
  label: string;
  observedValue: unknown;
  rule: string;
  maxWeight: number;
  contribution: number | null;
  status: 'disponivel' | 'ausente' | 'dados_insuficientes';
  reason: string;
  numerator?: number | null;
  denominator?: number | null;
  quantitativeProgress?: QuantitativeProgress;
};

export type AdoptionModuleResult = {
  module: string;
  temporalType: TemporalType;
  score: number | null;
  status: AdoptionStatus;
  classification: string | null;
  configuration: { score: number | null; max: number; status: AdoptionStatus };
  activation: { score: number | null; max: number; status: AdoptionStatus };
  usage: { score: number | null; max: number; status: AdoptionStatus };
  indicators: AdoptionIndicatorResult[];
};
