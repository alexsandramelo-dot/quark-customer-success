import assert from 'node:assert/strict';
import { calculateAdoptionDashboard, rankCustomersByAdoption } from '../src/domain/dashboard/analytics.ts';
import { filterCustomers } from '../src/domain/dashboard/filters.ts';

const customers = [
  { clienteNome: 'Zero', active: true, csm: 'A', plan: 'P1', journey: 'ADOÇÃO', category: 'Ouro', overallScore: 0, modules: [{ name: 'M1', contractStatus: 'contratado', score: 0 }, { name: 'M2', contractStatus: 'contratado', score: 40 }, { name: 'M3', contractStatus: 'nao_incluso', score: 95 }] },
  { clienteNome: 'Bom', active: true, csm: 'A', plan: 'P1', journey: 'ADOÇÃO', category: 'Ouro', overallScore: 80, modules: [{ name: 'M1', contractStatus: 'contratado', score: 80 }, { name: 'M2', contractStatus: 'contratado', score: null }] },
  { clienteNome: 'Sem score', active: false, csm: 'B', plan: 'P2', journey: 'ONBOARDING', category: 'Prata', overallScore: null, modules: [{ name: 'M1', contractStatus: 'contratado', score: null }] },
];

const all = calculateAdoptionDashboard(customers);
assert.equal(all.average, 40);
assert.equal(all.evaluated, 2);
assert.equal(all.lowAdoption, 1);
assert.equal(all.insufficient, 1);
assert.deepEqual(all.topCustomers.map((customer) => customer.clienteNome), ['Bom', 'Zero']);
assert.deepEqual(all.bottomCustomers.map((customer) => customer.clienteNome), ['Zero', 'Bom']);
assert.equal(all.modules.find((module) => module.name === 'M1')?.contracted, 3);
assert.equal(all.modules.find((module) => module.name === 'M1')?.evaluated, 2);
assert.equal(all.modules.find((module) => module.name === 'M1')?.insufficient, 1);
assert.equal(all.modules.find((module) => module.name === 'M1')?.average, 40);
assert.equal(all.modules.find((module) => module.name === 'M1')?.lowAdoption, 1);
assert.deepEqual(all.modules.find((module) => module.name === 'M1')?.lowAdoptionCustomers.map((customer) => customer.clienteNome), ['Zero']);
assert.equal(all.modules.find((module) => module.name === 'M2')?.average, 40);
assert.equal(all.modules.some((module) => module.name === 'M3'), true);
assert.equal(all.modules.find((module) => module.name === 'M3')?.contracted, 0);
assert.equal(all.lowestUseModules.some((module) => module.name === 'M3'), false);
assert.deepEqual(all.modules.find((module) => module.name === 'M1')?.evaluatedCustomers.map((customer) => customer.clienteNome), ['Bom', 'Zero']);
assert.deepEqual(all.modules.find((module) => module.name === 'M1')?.insufficientCustomers.map((customer) => customer.clienteNome), ['Sem score']);

const active = filterCustomers(customers, { activeOnly: true });
const allStatus = filterCustomers(customers, { activeOnly: false });
assert.equal(active.length, 2);
assert.equal(allStatus.length, 3);
assert.equal(calculateAdoptionDashboard(active).average, 40);
assert.equal(calculateAdoptionDashboard(allStatus).insufficient, 1);
const filtered = filterCustomers(customers, { activeOnly: true, csm: 'A', plan: 'P1', journey: 'ADOÇÃO', category: 'Ouro' });
const filteredAnalytics = calculateAdoptionDashboard(filtered);
assert.equal(filteredAnalytics.population, 2);
assert.equal(filteredAnalytics.lowAdoption, 1);
assert.equal(filteredAnalytics.modules.find((module) => module.name === 'M1')?.contracted, 2);
assert.deepEqual(filterCustomers(customers, { category: 'Prata' }).map((customer) => customer.clienteNome), ['Sem score']);

const multiUnitCustomer = { clienteNome: 'Multi', overallScore: 70, modules: [{ name: 'M4', contractStatus: 'contratado', score: 70 }] };
assert.equal(calculateAdoptionDashboard([multiUnitCustomer]).modules[0]?.average, 70);
assert.equal(calculateAdoptionDashboard([multiUnitCustomer]).modules[0]?.evaluated, 1);

const rankingCustomers = [
  { clienteNome: 'Adoção zero', journey: 'ADOÇÃO', active: true, csm: 'A', plan: 'P', overallScore: 0 },
  { clienteNome: 'Adoção alta', journey: 'ADOÇÃO', active: true, csm: 'A', plan: 'P', overallScore: 80 },
  { clienteNome: 'Adoção null', journey: 'ADOÇÃO', active: true, csm: 'A', plan: 'P', overallScore: null },
  { clienteNome: 'Onboarding baixo', journey: 'ONBOARDING', active: true, csm: 'B', plan: 'P', overallScore: 15 },
  { clienteNome: 'Onboarding churn alto', journey: 'ONBOARDING', active: false, csm: 'B', plan: 'P', overallScore: 95 },
  { clienteNome: 'Onboarding médio', journey: 'ONBOARDING', active: true, csm: 'B', plan: 'P', overallScore: 60 },
  { clienteNome: 'Outra jornada', journey: 'IMPLANTAÇÃO', active: true, csm: 'C', plan: 'P', overallScore: 100 },
];
assert.deepEqual(rankCustomersByAdoption(rankingCustomers, 'ADOÇÃO', 'highest').map((customer) => customer.clienteNome), ['Adoção alta', 'Adoção zero']);
assert.deepEqual(rankCustomersByAdoption(rankingCustomers, 'ONBOARDING', 'highest').map((customer) => customer.clienteNome), ['Onboarding churn alto', 'Onboarding médio', 'Onboarding baixo']);
assert.deepEqual(rankCustomersByAdoption(rankingCustomers, 'ADOÇÃO', 'lowest').map((customer) => customer.clienteNome), ['Adoção zero', 'Adoção alta']);
assert.deepEqual(rankCustomersByAdoption(rankingCustomers, 'ONBOARDING', 'lowest').map((customer) => customer.clienteNome), ['Onboarding baixo', 'Onboarding médio', 'Onboarding churn alto']);
assert.equal(rankCustomersByAdoption(rankingCustomers, 'ADOÇÃO', 'highest').some((customer) => customer.overallScore === null), false);
assert.equal(rankCustomersByAdoption(rankingCustomers, 'ADOÇÃO', 'lowest').some((customer) => customer.overallScore === 0), true);
assert.equal(rankCustomersByAdoption(rankingCustomers, 'ONBOARDING', 'highest').length, 3); // fewer than 10
const globalAdoptionFilter = filterCustomers(rankingCustomers, { journey: 'ADOÇÃO' });
assert.deepEqual(rankCustomersByAdoption(globalAdoptionFilter, 'ADOÇÃO', 'highest').map((customer) => customer.clienteNome), ['Adoção alta', 'Adoção zero']);
assert.equal(rankCustomersByAdoption(globalAdoptionFilter, 'ONBOARDING', 'highest').length, 0);
const activeRankingCustomers = filterCustomers(rankingCustomers, { activeOnly: true });
assert.deepEqual(rankCustomersByAdoption(activeRankingCustomers, 'ONBOARDING', 'highest').map((customer) => customer.clienteNome), ['Onboarding médio', 'Onboarding baixo']);
const allStatusRankingCustomers = filterCustomers(rankingCustomers, { activeOnly: false });
assert.equal(rankCustomersByAdoption(allStatusRankingCustomers, 'ONBOARDING', 'highest')[0]?.clienteNome, 'Onboarding churn alto');
const moreAdoptionCustomers = Array.from({ length: 12 }, (_, index) => ({ clienteNome: `Adoção ${index}`, journey: 'ADOÇÃO', overallScore: index }));
assert.equal(rankCustomersByAdoption(moreAdoptionCustomers, 'ADOÇÃO', 'highest').length, 10);
assert.equal(rankCustomersByAdoption(moreAdoptionCustomers, 'ADOÇÃO', 'lowest').length, 10);

console.log('Dashboard analytics KPIs and module metrics: PASS');
console.log('Customer rankings: separate journeys, top/bottom, null exclusion, zero inclusion, global filters, active/CHURN, empty and 10-item limit: PASS');
