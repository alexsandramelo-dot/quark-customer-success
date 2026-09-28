import assert from 'node:assert/strict';
import { formatAdoptionScore } from '../src/domain/adoption/format.ts';

const original = 77.16117216117216;
assert.equal(formatAdoptionScore(original), '77,2%');
assert.equal(formatAdoptionScore(72.161172), '72,2%');
assert.equal(formatAdoptionScore(85), '85%');
assert.equal(formatAdoptionScore(100), '100%');
assert.equal(formatAdoptionScore(60.5), '60,5%');
assert.equal(original, 77.16117216117216, 'display formatting must not mutate source values');
assert.equal(formatAdoptionScore(null), 'Dados insuficientes');
console.log('Adoption presentation formatting passed: 7 scenarios');
