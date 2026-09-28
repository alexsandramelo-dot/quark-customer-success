export type DetailScope = { kind: 'consolidated' } | { kind: 'unit'; unitId: string; unitName: string | null };

export function makeDetailScope(unitId?: string | null, unitName?: string | null): DetailScope {
  return unitId ? { kind: 'unit', unitId: String(unitId), unitName: unitName?.trim() || null } : { kind: 'consolidated' };
}

export function detailContext(customerName: string | null, scope: DetailScope) {
  const customer = customerName?.trim() || 'Cliente sem nome';
  if (scope.kind === 'consolidated') return { unit: null, header: customer, breadcrumb: [customer] };
  const unit = scope.unitName || 'Unidade sem nome';
  return { unit, header: `${customer} > ${unit}`, breadcrumb: [customer, unit] };
}

export function findUnitById<T extends { unitId: string | null }>(units: T[] | undefined, unitId: string): T | null {
  return units?.find((unit) => unit.unitId !== null && String(unit.unitId) === String(unitId)) ?? null;
}
