import { formatCsmNames } from '../customer/format.ts';

export type DashboardFilterableCustomer = { clienteNome: string | null; csm: unknown; plan: string | null; journey: string | null; category?: string | null; active?: boolean; overallClassification?: string | null; overallScore?: number | null };

export function filterCustomers<T extends DashboardFilterableCustomer>(customers: T[], filters: { search?: string; csm?: string; plan?: string; journey?: string; category?: string; classification?: string; activeOnly?: boolean }) {
  const term = (filters.search ?? '').trim().toLocaleLowerCase('pt-BR');
  const classification = filters.classification === 'Todas' ? '' : filters.classification;
  return customers.filter((customer) =>
    (filters.activeOnly !== true || customer.active !== false) &&
    (!term || (customer.clienteNome ?? '').toLocaleLowerCase('pt-BR').includes(term)) &&
    (!filters.csm || formatCsmNames(customer.csm) === filters.csm) &&
    (!filters.plan || (customer.plan?.trim() || 'Plano não informado') === filters.plan) &&
    (!filters.journey || (customer.journey?.trim() || 'Jornada não informada') === filters.journey) &&
    (!filters.category || (customer.category?.trim() || 'Categoria não informada') === filters.category) &&
    (!classification || (classification === 'Dados insuficientes' ? customer.overallScore === null : customer.overallClassification === classification))
  );
}
