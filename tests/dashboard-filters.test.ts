import assert from 'node:assert/strict';
import { filterCustomers } from '../src/domain/dashboard/filters.ts';
import { getPortfolioMetrics } from '../src/domain/dashboard/portfolioMetrics.ts';
import { formatCsmNames, formatProcessedDate } from '../src/domain/customer/format.ts';
const customers = [
  { clienteNome: 'Hospital Central', csm: 'Fernanda', plan: 'Premium', journey: 'Adoção', category: 'Ouro', overallClassification: 'Baixa adoção', overallScore: 60 },
  { clienteNome: 'Hospital Norte', csm: 'Fernanda', plan: null, journey: null, overallClassification: 'Boa adoção', overallScore: 72.2 },
  { clienteNome: 'Clínica Sul', csm: null, plan: 'Essencial', journey: 'Implantação', overallClassification: 'Alta adoção', overallScore: 90 },
  { clienteNome: 'Cliente sem score', csm: 'Fernanda', plan: 'Premium', journey: 'Adoção', overallClassification: null, overallScore: null },
];
assert.equal(filterCustomers(customers, { search: 'hospital' }).length, 2);
assert.equal(filterCustomers(customers, { csm: 'CSM não informado' })[0].clienteNome, 'Clínica Sul');
assert.equal(filterCustomers(customers, { plan: 'Plano não informado' })[0].clienteNome, 'Hospital Norte');
assert.equal(filterCustomers(customers, { category: 'Ouro' })[0].clienteNome, 'Hospital Central');
assert.equal(filterCustomers(customers, { category: 'Categoria não informada' }).length, 3);
assert.equal(filterCustomers(customers, { journey: 'Jornada não informada' })[0].clienteNome, 'Hospital Norte');
assert.equal(filterCustomers(customers, { search: 'hospital', csm: 'Fernanda', plan: 'Premium', journey: 'Adoção' }).length, 1);
assert.equal(formatCsmNames(['Maria Fernanda Rocha Santiago Araújo']), 'Maria Fernanda Rocha Santiago Araújo');
assert.equal(formatCsmNames(['Maria Fernanda Rocha Santiago Araújo', 'Lucas Miranda']), 'Maria Fernanda Rocha Santiago Araújo, Lucas Miranda');
assert.equal(formatCsmNames('[Maria Fernanda Rocha Santiago Araújo]'), 'Maria Fernanda Rocha Santiago Araújo');
assert.equal(filterCustomers([{ clienteNome: 'Cliente', csm: ['Maria', 'Lucas'], plan: 'Premium', journey: 'Adoção' }], { csm: 'Maria, Lucas' }).length, 1);
assert.equal(filterCustomers(customers, { search: 'inexistente' }).length, 0);
assert.deepEqual(filterCustomers(customers, { classification: 'Baixa adoção' }).map(customer => customer.clienteNome), ['Hospital Central']);
assert.deepEqual(filterCustomers(customers, { classification: 'Boa adoção' }).map(customer => customer.clienteNome), ['Hospital Norte']);
assert.deepEqual(filterCustomers(customers, { classification: 'Alta adoção' }).map(customer => customer.clienteNome), ['Clínica Sul']);
assert.deepEqual(filterCustomers(customers, { classification: 'Dados insuficientes' }).map(customer => customer.clienteNome), ['Cliente sem score']);
assert.equal(filterCustomers(customers, { classification: 'Todas', plan: 'Premium' }).length, 2);
assert.equal(filterCustomers(customers, { csm: 'Fernanda', plan: 'Premium', classification: 'Baixa adoção' }).length, 1);
const metricsCustomers = [
  { clienteNome: 'Cliente A', overallScore: 80, insufficientModules: 2 },
  { clienteNome: 'Cliente B', overallScore: 40, insufficientModules: 0 },
  { clienteNome: 'Cliente C', overallScore: null, insufficientModules: 3 },
];
assert.equal(getPortfolioMetrics(metricsCustomers).averageAdoption, 60);
assert.equal(getPortfolioMetrics(metricsCustomers).insufficientModules, 5);
assert.deepEqual(getPortfolioMetrics(metricsCustomers).insufficientCustomers.map((customer) => customer.clienteNome), ['Cliente A', 'Cliente C']);
const filteredMetrics = getPortfolioMetrics(metricsCustomers.filter((customer) => customer.clienteNome !== 'Cliente B'));
assert.equal(filteredMetrics.averageAdoption, 80);
assert.equal(filteredMetrics.insufficientModules, 5);
assert.deepEqual(filteredMetrics.insufficientCustomers.map((customer) => customer.clienteNome), ['Cliente A', 'Cliente C']);
assert.equal(getPortfolioMetrics([]).averageAdoption, null);
assert.equal(getPortfolioMetrics([]).insufficientModules, 0);
assert.deepEqual(filterCustomers(customers, { search: 'norte', classification: 'Boa adoção' }).map(customer => customer.clienteNome), ['Hospital Norte']);
assert.equal(filterCustomers(customers, { search: 'norte', classification: 'Alta adoção' }).length, 0);
const sourceCustomers = [
  { clienteNome: 'Ativo 1', active: true, csm: 'CSM A', plan: 'Premium', journey: 'Adoção', overallScore: 80, insufficientModules: 2 },
  { clienteNome: 'Ativo 2', active: true, csm: 'CSM B', plan: 'Essencial', journey: 'Implantação', overallScore: 40, insufficientModules: 0 },
  { clienteNome: 'Churn 1', active: false, csm: 'CSM A', plan: 'Premium', journey: 'Adoção', overallScore: null, insufficientModules: 3 },
];
const activePopulation = filterCustomers(sourceCustomers, { activeOnly: true });
assert.deepEqual(activePopulation.map((customer) => customer.clienteNome), ['Ativo 1', 'Ativo 2']);
assert.deepEqual(filterCustomers(sourceCustomers, { activeOnly: false }).map((customer) => customer.clienteNome), ['Ativo 1', 'Ativo 2', 'Churn 1']);
assert.deepEqual(filterCustomers(sourceCustomers, { activeOnly: true, csm: 'CSM A', plan: 'Premium', journey: 'Adoção' }).map((customer) => customer.clienteNome), ['Ativo 1']);
assert.deepEqual(filterCustomers(sourceCustomers, { activeOnly: false, csm: 'CSM A', plan: 'Premium', journey: 'Adoção' }).map((customer) => customer.clienteNome), ['Ativo 1', 'Churn 1']);
assert.equal(getPortfolioMetrics(activePopulation).averageAdoption, 60);
assert.equal(getPortfolioMetrics(activePopulation).insufficientModules, 2);
const allSourceMetrics = getPortfolioMetrics(filterCustomers(sourceCustomers, { activeOnly: false }));
assert.equal(allSourceMetrics.averageAdoption, 60);
assert.equal(allSourceMetrics.insufficientModules, 5);
assert.deepEqual(allSourceMetrics.insufficientCustomers.map((customer) => customer.clienteNome), ['Ativo 1', 'Churn 1']);
assert.equal(formatProcessedDate('2026-09-24T02:30:00.000Z'), '23/09/2026');
assert.equal(formatProcessedDate(undefined), null);
assert.equal(formatProcessedDate('invalid'), null);
console.log('Dashboard filter, active/churn population, filtered portfolio metrics, CSM formatter and persisted date tests passed: 35 scenarios');
