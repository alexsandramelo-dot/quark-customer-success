import assert from 'node:assert/strict';
import { detailContext, findUnitById, makeDetailScope } from '../src/domain/dashboard/detailScope.ts';

const unitA = { unitId: '10', unitName: 'Natal', indicators: { colaboradores: 250 } };
const unitB = { unitId: '20', unitName: 'Recife', indicators: { colaboradores: 400 } };
const units = [unitA, unitB];

const general = makeDetailScope(null, 'Natal');
assert.deepEqual(general, { kind: 'consolidated' }, 'Matriz Geral must not infer a unit from its display name.');
assert.deepEqual(detailContext('Cliente X', general), { unit: null, header: 'Cliente X', breadcrumb: ['Cliente X'] });

const scopeA = makeDetailScope('10', 'Natal');
const scopeB = makeDetailScope('20', 'Recife');
assert.equal(scopeA.kind, 'unit');
assert.equal(findUnitById(units, scopeA.unitId), unitA);
assert.equal(findUnitById(units, scopeB.unitId), unitB);
assert.equal(findUnitById(units, 'missing'), null, 'Unknown unit ids must not fall back to another unit.');
assert.deepEqual(detailContext('Cliente X', scopeA), { unit: 'Natal', header: 'Cliente X > Natal', breadcrumb: ['Cliente X', 'Natal'] });
assert.deepEqual(detailContext('Cliente X', { kind: 'unit', unitId: '10', unitName: null }), { unit: 'Unidade sem nome', header: 'Cliente X > Unidade sem nome', breadcrumb: ['Cliente X', 'Unidade sem nome'] });

const shownA = findUnitById(units, scopeA.unitId)?.indicators.colaboradores;
const shownB = findUnitById(units, scopeB.unitId)?.indicators.colaboradores;
assert.equal(shownA, 250, 'Unit detail must use unit A data only.');
assert.equal(shownB, 400, 'Unit detail must use unit B data only.');
assert.notEqual(shownA, shownB, 'Unit details must not mix values between units.');

console.log('Detail scope tests passed: consolidated scope, exact unit id isolation, breadcrumb/header, missing name and no unit fallbacks');
