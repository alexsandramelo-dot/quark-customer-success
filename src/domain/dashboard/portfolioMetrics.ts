export type PortfolioMetricCustomer = {
  clienteNome: string | null;
  overallScore: number | null;
  insufficientModules: number;
};

export function getPortfolioMetrics<T extends PortfolioMetricCustomer>(customers: T[]) {
  const scores = customers
    .map((customer) => customer.overallScore)
    .filter((score): score is number => score !== null);
  const insufficientCustomers = customers.filter((customer) => customer.insufficientModules > 0);

  return {
    averageAdoption: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    insufficientCustomers,
    insufficientModules: insufficientCustomers.reduce((sum, customer) => sum + customer.insufficientModules, 0),
  };
}
