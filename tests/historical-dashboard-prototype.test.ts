import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  classifyHistoricalDrop,
  filterHistoricalAlerts,
  historicalAlertsMock,
  historicalPortfolioMock,
  largestAdoptionDropsMock,
  moduleUsageDropsMock,
} from '../src/data/historicalDashboardMock.ts';

assert.equal(classifyHistoricalDrop(0), 'Estável');
assert.equal(classifyHistoricalDrop(-4.9), 'Estável');
assert.equal(classifyHistoricalDrop(-5), 'Em queda');
assert.equal(classifyHistoricalDrop(-9.9), 'Em queda');
assert.equal(classifyHistoricalDrop(-10), 'Atenção');
assert.equal(classifyHistoricalDrop(-19.9), 'Atenção');
assert.equal(classifyHistoricalDrop(-20), 'Crítico');
assert.equal(classifyHistoricalDrop(2), 'Estável');

assert.deepEqual(historicalPortfolioMock.map(({ adoption }) => adoption), [72, 74, 75, 73, 70, 68]);
assert.deepEqual(largestAdoptionDropsMock.map(({ dropPp }) => dropPp), [21, 17, 14, 11, 8]);
assert.deepEqual(moduleUsageDropsMock.map(({ dropPp }) => dropPp), [15, 12, 9, 7, 4]);
assert.equal(filterHistoricalAlerts('Todos').length, historicalAlertsMock.length);
assert.equal(filterHistoricalAlerts('Estável').length, 1);
assert.equal(filterHistoricalAlerts('Estável')[0].customerName, 'Instituto Sigma');
assert.equal(filterHistoricalAlerts('Em queda').every((alert) => classifyHistoricalDrop(alert.changePp) === 'Em queda'), true);
assert.equal(filterHistoricalAlerts('Atenção').every((alert) => classifyHistoricalDrop(alert.changePp) === 'Atenção'), true);
assert.equal(filterHistoricalAlerts('Crítico').every((alert) => classifyHistoricalDrop(alert.changePp) === 'Crítico'), true);
assert.equal(historicalAlertsMock.find((alert) => alert.id === 'clinica-gama')?.readings.join(' → '), '83 → 76 → 69');

const componentSource = await readFile(new URL('../src/components/HistoricalDashboardPrototype.tsx', import.meta.url), 'utf8');
assert.equal(/fetch\s*\(|apiUrl\s*\(/.test(componentSource), false, 'the contact prototype must not call a backend API');
const dashboardSource = await readFile(new URL('../src/components/AdoptionAnalyticsDashboard.tsx', import.meta.url), 'utf8');
assert.equal((dashboardSource.match(/<HistoricalDashboardPrototype\s*\/>/g) ?? []).length, 2, 'the demo prototype must remain available when real-dashboard filters have no matches');
const alertsPageSource = await readFile(new URL('../src/components/HistoricalAlertsPage.tsx', import.meta.url), 'utf8');
assert.match(componentSource, /mode === 'alerts'/);
assert.match(componentSource, /historical-analytics-page/);
assert.match(componentSource, /historical-alert-workspace/);
assert.match(alertsPageSource, /<HistoricalDashboardPrototype mode="alerts" \/>/);
assert.match(alertsPageSource, /active="alerts"/);

console.log('Historical dashboard prototype tests passed: mock data, visual thresholds, quick filters, readings and simulated-only contact.');
