const adoptionNumberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function formatAdoptionNumber(value: number): string {
  return adoptionNumberFormatter.format(value);
}

export function formatAdoptionScore(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Dados insuficientes' : `${formatAdoptionNumber(value)}%`;
}
