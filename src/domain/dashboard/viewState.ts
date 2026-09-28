export type PortfolioViewState = 'loading' | 'empty' | 'ready';

export function getPortfolioViewState(loading: boolean, customerCount: number): PortfolioViewState {
  if (loading) return 'loading';
  return customerCount === 0 ? 'empty' : 'ready';
}
