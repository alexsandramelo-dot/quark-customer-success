import { formatAdoptionScore } from '../adoption/format.ts';

export type ModuleUseState = 'utiliza' | 'zero_conhecido' | 'parcial' | 'sem_dado';

export function moduleUseState(module: { name?: string; hasUsageIndicators?: boolean; usage?: number | null; status?: string; indicators?: Array<{ id?: string; value?: unknown }> }) : ModuleUseState {
  if (!module.hasUsageIndicators) return 'sem_dado';
  if (module.usage === null || module.usage === undefined || module.status === 'dados_insuficientes') return 'parcial';
  if (module.name === 'Departamento Pessoal') {
    const employeeCount = module.indicators?.find((indicator) => indicator.id === 'employees-total')?.value;
    if (typeof employeeCount === 'number') return employeeCount > 0 ? 'utiliza' : 'zero_conhecido';
    return 'parcial';
  }
  return module.usage > 0 ? 'utiliza' : 'zero_conhecido';
}

export function moduleAdoptionLabel(module: { score?: number | null; contractStatus?: string; status?: string }) {
  if (module.score !== null && module.score !== undefined) return formatAdoptionScore(module.score);
  if (module.contractStatus !== 'contratado') return 'Não aplicável';
  return module.status === 'sem_dados_uso' ? 'Sem dados' : 'Dados insuficientes';
}

export function unitAdoptionLabel(name: string, score: number | null) {
  const formattedScore = formatAdoptionScore(score);
  return `${name} — Adoção: ${formattedScore}`;
}

export function groupModules<T extends { contractStatus: string; hasUsageIndicators: boolean; score: number | null; status: string }>(modules: T[]) {
  return [
    { title: 'Módulos contratados', list: modules.filter((module) => module.contractStatus === 'contratado') },
    { title: 'Módulos não inclusos', list: modules.filter((module) => module.contractStatus === 'nao_incluso') },
    { title: 'Módulos com indicadores', list: modules.filter((module) => module.hasUsageIndicators) },
    { title: 'Módulos sem indicadores', list: modules.filter((module) => !module.hasUsageIndicators) },
    { title: 'Módulos calculáveis', list: modules.filter((module) => module.score !== null) },
    { title: 'Dados insuficientes', list: modules.filter((module) => module.status === 'dados_insuficientes') },
  ];
}
