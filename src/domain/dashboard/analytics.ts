import { classifyAdoption } from '../adoption/classification.ts';

export type AnalyticsModule = { name: string; contractStatus: string; score: number | null; status?: string | null };
export type AnalyticsCustomer = { clienteNome: string | null; journey?: string | null; overallScore: number | null; overallClassification?: string | null; modules?: AnalyticsModule[] };
export type ModuleAnalytics = { name: string; contracted: number; evaluated: number; insufficient: number; average: number | null; lowAdoption: number; evaluatedCustomers: AnalyticsCustomer[]; insufficientCustomers: AnalyticsCustomer[]; lowAdoptionCustomers: AnalyticsCustomer[] };

const validScore = (score: number | null) => score !== null && Number.isFinite(score);
const byName = (a: AnalyticsCustomer, b: AnalyticsCustomer) => (a.clienteNome ?? '').localeCompare(b.clienteNome ?? '', 'pt-BR');

export function rankCustomersByAdoption(customers: AnalyticsCustomer[], journey: 'ADOÇÃO' | 'ONBOARDING', direction: 'highest' | 'lowest') {
  const eligible = customers.filter((customer) => customer.journey === journey && validScore(customer.overallScore));
  const ordered = eligible.sort((a, b) => direction === 'highest'
    ? b.overallScore! - a.overallScore! || byName(a, b)
    : a.overallScore! - b.overallScore! || byName(a, b));
  return ordered.slice(0, 10);
}

export function calculateAdoptionDashboard(customers: AnalyticsCustomer[]) {
  const evaluatedCustomers = customers.filter((customer) => validScore(customer.overallScore));
  const average = evaluatedCustomers.length ? evaluatedCustomers.reduce((sum, customer) => sum + customer.overallScore!, 0) / evaluatedCustomers.length : null;
  const scored = [...evaluatedCustomers].sort((a, b) => b.overallScore! - a.overallScore! || byName(a, b));
  const moduleNames = [...new Set(customers.flatMap((customer) => customer.modules ?? []).map((module) => module.name))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const modules: ModuleAnalytics[] = moduleNames.map((name) => {
    const contractedCustomers = customers.filter((customer) => customer.modules?.some((module) => module.name === name && module.contractStatus === 'contratado'));
    const evaluated = contractedCustomers.filter((customer) => {
      const module = customer.modules?.find((item) => item.name === name);
      return !!module && validScore(module.score);
    });
    const insufficient = contractedCustomers.filter((customer) => {
      const module = customer.modules?.find((item) => item.name === name);
      return !!module && module.score === null;
    });
    const low = evaluated.filter((customer) => classifyAdoption(customer.modules!.find((module) => module.name === name)!.score) === 'Baixa adoção');
    const moduleAverage = evaluated.length ? evaluated.reduce((sum, customer) => sum + customer.modules!.find((module) => module.name === name)!.score!, 0) / evaluated.length : null;
    return { name, contracted: contractedCustomers.length, evaluated: evaluated.length, insufficient: insufficient.length, average: moduleAverage, lowAdoption: low.length, evaluatedCustomers: evaluated.sort(byName), insufficientCustomers: insufficient.sort(byName), lowAdoptionCustomers: low.sort(byName) };
  });
  const lowFirst = [...modules].filter((module) => module.average !== null).sort((a, b) => a.average! - b.average! || a.name.localeCompare(b.name, 'pt-BR'));
  const highFirst = [...modules].filter((module) => module.average !== null).sort((a, b) => b.average! - a.average! || a.name.localeCompare(b.name, 'pt-BR'));
  return {
    population: customers.length,
    average,
    evaluated: evaluatedCustomers.length,
    lowAdoption: evaluatedCustomers.filter((customer) => classifyAdoption(customer.overallScore) === 'Baixa adoção').length,
    insufficient: customers.length - evaluatedCustomers.length,
    topCustomers: scored.slice(0, 10),
    bottomCustomers: scored.slice(-10).reverse(),
    modules,
    lowestUseModules: lowFirst,
    mostUsedModules: highFirst,
  };
}
