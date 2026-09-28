import assert from 'node:assert/strict';
import { getPortfolioViewState } from '../src/domain/dashboard/viewState.ts';

assert.equal(getPortfolioViewState(true, 0), 'loading');
assert.equal(getPortfolioViewState(true, 4), 'loading');
assert.equal(getPortfolioViewState(false, 0), 'empty');
assert.equal(getPortfolioViewState(false, 1), 'ready');
console.log('Portfolio loading/empty/ready state passed: 4 scenarios');
