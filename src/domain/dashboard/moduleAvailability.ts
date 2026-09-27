type IndicatorEvidence = { id?: string; label?: string; status?: string; reason?: string | null };
type ConsolidationEvidence = { indicator?: string; rule?: string | null; status?: string; reason?: string | null };

export type ModuleAvailabilityInput = {
  score?: number | null;
  status?: string;
  contractStatus?: string;
  hasUsageIndicators?: boolean;
  usageReason?: string | null;
  indicators?: IndicatorEvidence[];
  consolidationDetails?: ConsolidationEvidence[];
};

export function moduleAvailabilityReason(module: ModuleAvailabilityInput): string | null {
  if (module.score !== null && module.score !== undefined) return null;
  if (module.contractStatus === 'nao_incluso') return 'Não aplicável — módulo não contratado.';
  if (module.status === 'sem_dados_uso' || !module.hasUsageIndicators) return 'Sem indicadores importados para este módulo.';
  if (module.usageReason) return module.usageReason;

  const indicators = module.indicators ?? [];
  if (indicators.length === 0) return 'Indicadores reais importados, mas nenhum tem mapeamento para o motor de adoção.';

  const consolidationBlocks = (module.consolidationDetails ?? []).filter((item) => {
    const rule = String(item.rule ?? '').toLocaleUpperCase('pt-BR');
    return item.status !== 'calculado' && (rule.includes('NÃO SOMAR AUTOMATICAMENTE') || rule.includes('REVISAR REGRA'));
  });
  const missingDenominators = indicators.filter((item) => /denominador/i.test(item.reason ?? ''));
  const missingIndicators = indicators.filter((item) => item.status === 'ausente');
  const reasons: string[] = [];
  if (consolidationBlocks.length) reasons.push(`consolidação bloqueada: ${[...new Set(consolidationBlocks.map((item) => item.indicator).filter(Boolean))].join(', ')}`);
  if (missingDenominators.length) reasons.push(`denominador necessário não disponível: ${[...new Set(missingDenominators.map((item) => item.label ?? item.id).filter(Boolean))].join(', ')}`);
  if (missingIndicators.length) reasons.push(`indicador obrigatório ausente: ${[...new Set(missingIndicators.map((item) => item.label ?? item.id).filter(Boolean))].join(', ')}`);
  if (reasons.length) return `Dados insuficientes — ${reasons.join('; ')}. O motor atual exige os componentes definidos para fechar o score.`;
  return 'Dados insuficientes — os componentes disponíveis não completam as regras necessárias pelo motor para calcular o score.';
}
