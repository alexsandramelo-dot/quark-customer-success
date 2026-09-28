import assert from 'node:assert/strict';
import { fetchAllClickUpTasks, consolidateClickUpTasks, clickUpRosterCsv } from '../scripts/ingestion/clickup.mjs';
import { processFiles } from '../scripts/ingestion/core.mjs';

const paged = await fetchAllClickUpTasks('fake-list', { token: 'test-token', request: async (path) => {
  const page = Number(new URL(`https://clickup.test${path}`).searchParams.get('page'));
  return { tasks: page === 0 ? Array.from({ length: 100 }, (_, index) => ({ id: String(index), name: `Client ${index}` })) : page === 1 ? Array.from({ length: 7 }, (_, index) => ({ id: `100-${index}`, name: `Client ${index}` })) : [] };
} });
assert.equal(paged.tasks.length, 107);
assert.equal(paged.pages.length, 2);
assert.equal(paged.pageRequests, 3);

const sharedIds = { plan: 'plan-field', journey: 'journey-field', csm: 'csm-field', signedAt: 'signed-field', mrr: 'mrr-field', goLiveAt: 'live-field' };
const fields = (categoryId) => [
  { id: sharedIds.plan, name: '6. PLANO:', type: 'drop_down', type_config: { options: ['Essencial', 'Empresarial', 'Premium'] } },
  { id: sharedIds.journey, name: '1. JORNADA DO CLIENTE:', type: 'drop_down', type_config: { options: ['ONBOARDING', 'ADOÇÃO'] } },
  { id: sharedIds.csm, name: '11. CSM Responsável', type: 'users' },
  { id: sharedIds.signedAt, name: '7. DATA DE ASSINATURA', type: 'date' },
  { id: sharedIds.mrr, name: '5. MRR', type: 'currency' },
  { id: categoryId, name: '9. CATEGORIA RH:', type: 'formula' },
  { id: sharedIds.goLiveAt, name: '17. DATA DE VIRADA CHAVE', type: 'date' },
];
const fieldValues = ({ plan = 'Premium', journey = 'ONBOARDING', csm = 'CSM A', signedAt = 1790348400000, mrr = '285', category = 'Basic', goLiveAt = null }, categoryId) => [
  { id: sharedIds.plan, value: { name: plan } }, { id: sharedIds.journey, value: { name: journey } },
  { id: sharedIds.csm, value: [{ username: csm }] }, { id: sharedIds.signedAt, value: signedAt },
  { id: sharedIds.mrr, value: mrr }, { id: categoryId, value: category }, { id: sharedIds.goLiveAt, value: goLiveAt },
];
const baseCategory = 'category-base';
const churnCategory = 'category-churn';
const result = consolidateClickUpTasks([
  { id: '901113131199', name: 'Base de Clientes RH', fields: fields(baseCategory), tasks: [
    { id: 'active-1', name: 'Cliente ativo', custom_fields: fieldValues({}, baseCategory) },
    { id: 'shared-base', name: ' Cliente Compartilhado ', custom_fields: fieldValues({ plan: 'Empresarial' }, baseCategory) },
  ] },
  { id: '901113348988', name: 'CHURN', fields: fields(churnCategory), tasks: [
    { id: 'churn-only', name: 'Cliente churn', status: { status: 'fim' }, custom_fields: fieldValues({}, churnCategory) },
    { id: 'shared-churn', name: 'cliente   compartilhado', status: { status: 'cancelado' }, custom_fields: fieldValues({ plan: 'Premium' }, churnCategory) },
  ] },
]);
assert.equal(result.clients.length, 3);
assert.equal(result.clients.find((client) => client.name === 'Cliente ativo').active, true);
assert.equal(result.clients.find((client) => client.name === 'Cliente ativo').values.category, 'Basic');
assert.equal(result.clients.find((client) => client.name === 'Cliente churn').active, false);
const shared = result.clients.find((client) => client.name === 'Cliente Compartilhado');
assert.equal(shared.active, true);
assert.deepEqual(shared.sources, ['BASE_CLIENTES_RH', 'CHURN']);
assert.equal(shared.values.plan, 'Empresarial');
assert.equal(shared.sourceConflicts.some((conflict) => conflict.field === 'plan'), true);
assert.equal(result.duplicateDiagnostics.length, 1);
assert.equal(result.sourceCounts.base, 2);
assert.equal(result.sourceCounts.churn, 2);
assert.equal(fields(baseCategory).find((field) => field.name.includes('CATEGORIA RH')).id, baseCategory);
assert.equal(fields(churnCategory).find((field) => field.name.includes('CATEGORIA RH')).id, churnCategory);

const indexedDropdown = consolidateClickUpTasks([{ id: '901113131199', name: 'Base', fields: [
  { id: sharedIds.plan, name: '6. PLANO:', type: 'drop_down', type_config: { options: [{ id: 'ess', name: 'Essencial', orderindex: 0 }, { id: 'emp', name: 'Empresarial', orderindex: 1 }, { id: 'pre', name: 'Premium', orderindex: 2 }] } },
  { id: sharedIds.journey, name: '1. JORNADA DO CLIENTE:', type: 'drop_down', type_config: { options: [{ id: 'onb', name: 'ONBOARDING', orderindex: 0 }, { id: 'ado', name: 'ADOÇÃO', orderindex: 1 }] } },
  { id: sharedIds.csm, name: '11. CSM Responsável', type: 'users' },
  { id: sharedIds.signedAt, name: '7. DATA DE ASSINATURA', type: 'date' },
  { id: sharedIds.mrr, name: '5. MRR', type: 'currency' },
  { id: baseCategory, name: '9. CATEGORIA RH:', type: 'formula' },
], tasks: [
  { id: 'indexed', name: 'Cadastro dropdown index', custom_fields: [
    { id: sharedIds.plan, value: 2 }, { id: sharedIds.journey, value: 1 },
    { id: sharedIds.csm, value: [{ username: 'CSM Teste' }] }, { id: sharedIds.signedAt, value: '1790348400000' },
    { id: sharedIds.mrr, value: '285' }, { id: baseCategory, value: { value: { value: 'Ouro' } } },
  ] },
  { id: 'object', name: 'Cadastro dropdown objeto', custom_fields: [
    { id: sharedIds.plan, value: { id: 'emp', name: 'Empresarial', color: '#fff', orderindex: 1 } },
    { id: sharedIds.journey, value: { id: 'ado', name: 'ADOÇÃO', color: '#fff', orderindex: 1 } },
  ] },
]}]).clients;
assert.equal(indexedDropdown.find((client) => client.name === 'Cadastro dropdown index').values.plan, 'Premium');
assert.equal(indexedDropdown.find((client) => client.name === 'Cadastro dropdown index').values.journey, 'ADOÇÃO');
assert.equal(indexedDropdown.find((client) => client.name === 'Cadastro dropdown index').values.category, 'Ouro');
assert.equal(indexedDropdown.find((client) => client.name === 'Cadastro dropdown index').values.mrr, 285);
assert.equal(indexedDropdown.find((client) => client.name === 'Cadastro dropdown index').values.signedAt, '2026-09-25');
assert.equal(indexedDropdown.find((client) => client.name === 'Cadastro dropdown index').values.csm[0], 'CSM Teste');
assert.equal(indexedDropdown.find((client) => client.name === 'Cadastro dropdown objeto').values.plan, 'Empresarial');
assert.equal(indexedDropdown.find((client) => client.name === 'Cadastro dropdown objeto').values.journey, 'ADOÇÃO');
const usageA = Buffer.from('cliente_nome,modulo,indicador,valor\n Cliente A ,Frequência,configuracao_de_frequencia_ativa,true\nCliente A,Frequência,possui_horarios,true\nCliente A,Frequência,possui_jornadas,true\nCliente A,Frequência,colaboradores_registrando_ponto,8\nCliente A,Frequência,colaboradores_elegiveis,10\nCliente A,Frequência,existe_tratamento_de_ponto,true\nCliente A,Frequência,existem_solicitacoes_de_frequencia,true\nCliente B,Frequência,colaboradores_registrando_ponto,0\nCliente B,Frequência,colaboradores_elegiveis,10\n');
const usageB = Buffer.from('cliente_nome,modulo,indicador,valor\nCliente A,Férias,solicitacoes,2\nCliente B,Frequência,possui_horarios,false\n');
const normalizedRosterCsv = clickUpRosterCsv([indexedDropdown.find((client) => client.name === 'Cadastro dropdown index')]);
assert.equal(normalizedRosterCsv.toString().includes('{"id":"pre"'), false);
assert.equal(normalizedRosterCsv.toString().includes('"Premium"'), true);
assert.equal(normalizedRosterCsv.toString().includes('"ADOÇÃO"'), true);
const normalizedPipeline = await processFiles([
  { filename: 'clickup-clientes-normalizados.csv', content: normalizedRosterCsv },
  { filename: 'indicadores-a.csv', content: usageA },
]);
assert.equal(normalizedPipeline.canProcess, true, JSON.stringify(normalizedPipeline.errors));
assert.equal(normalizedPipeline.customers[0].planStatus, 'ok');
assert.equal(normalizedPipeline.customers[0].contractedModules.length, 18);

const activeClient = { ...result.clients.find((client) => client.name === 'Cliente ativo'), values: { ...result.clients[0].values, plan: 'Essencial' } };
const churnClient = { ...result.clients.find((client) => client.name === 'Cliente churn'), values: { ...result.clients[0].values, plan: 'Essencial' } };
const rosterCsv = clickUpRosterCsv([activeClient, churnClient]);
assert.equal(rosterCsv.toString().includes('test-token'), false);
const synced = await processFiles([
  { filename: 'clickup-clientes.csv', content: clickUpRosterCsv([
    { ...activeClient, name: 'Cliente A', values: { ...activeClient.values, plan: 'Essencial' } },
    { ...churnClient, name: 'Cliente B', values: { ...churnClient.values, plan: 'Essencial' } },
    { ...shared, name: 'Cliente compartilhado', values: { ...shared.values, plan: 'Empresarial' } },
  ]) },
  { filename: 'indicadores-a.csv', content: usageA }, { filename: 'indicadores-b.csv', content: usageB },
]);
assert.equal(synced.canProcess, true, JSON.stringify(synced.errors));
const syncedActive = synced.customers.find((client) => client.clienteNome === 'Cliente A');
const syncedChurn = synced.customers.find((client) => client.clienteNome === 'Cliente B');
assert.equal(syncedActive.active, true);
assert.equal(syncedActive.sources[0], 'BASE_CLIENTES_RH');
assert.equal(syncedChurn.active, false);
assert.equal(syncedChurn.sources[0], 'CHURN');
assert.equal(syncedChurn.planStatus, 'ok');
assert.ok(syncedChurn.contractedModules.includes('Frequência'));
assert.ok(syncedChurn.modules.length > 0);
assert.ok(syncedChurn.modules.some((module) => module.hasUsageIndicators));
const syncedShared = synced.customers.find((client) => client.clienteNome === 'Cliente compartilhado');
assert.equal(syncedShared.active, true);
assert.deepEqual(syncedShared.sources, ['BASE_CLIENTES_RH', 'CHURN']);
assert.equal(syncedShared.sourceConflicts[0].field, 'plan');
assert.ok(synced.diagnostics.indicatorFilesProcessed >= 1);

// ClickUp metadata refresh must retain spreadsheet-owned units and indicators.
const company = (plan, csm, journey, mrr, category) => ({
  name: 'EMPRESA TESTE', active: true, sources: ['BASE_CLIENTES_RH'], sourceConflicts: [],
  values: { plan, csm, journey, mrr, category, signedAt: 1790348400000, goLiveAt: null },
});
const clickupOnly = { ...company('QuarkRH Premium', 'Maria', 'ADOÇÃO', '500', 'Ouro'), name: 'CLIENTE SEM PLANILHA' };
const indicatorRows = [
  ['EMPRESA TESTE','10','Unidade Natal','Assinatura Eletrônica','data_primeiro_documento','2026-01-02'],
  ['EMPRESA TESTE','10','Unidade Natal','Assinatura Eletrônica','qtd_documentos_total','12'],
  ['EMPRESA TESTE','10','Unidade Natal','Assinatura Eletrônica','qtd_documentos_90_dias','6'],
  ['EMPRESA TESTE','10','Unidade Natal','Assinatura Eletrônica','qtd_documentos_finalizados_90_dias','5'],
  ['EMPRESA TESTE','10','Unidade Natal','Assinatura Eletrônica','unidade_ativa_90_dias','true'],
  ['EMPRESA TESTE','20','Unidade Mossoró','Assinatura Eletrônica','data_primeiro_documento','2026-01-03'],
  ['EMPRESA TESTE','20','Unidade Mossoró','Assinatura Eletrônica','qtd_documentos_total','8'],
  ['EMPRESA TESTE','20','Unidade Mossoró','Assinatura Eletrônica','qtd_documentos_90_dias','4'],
  ['EMPRESA TESTE','20','Unidade Mossoró','Assinatura Eletrônica','qtd_documentos_finalizados_90_dias','3'],
  ['EMPRESA TESTE','20','Unidade Mossoró','Assinatura Eletrônica','unidade_ativa_90_dias','true'],
];
const indicatorCsv = Buffer.from(['cliente_nome,unidade_id,unidade_nome,modulo,indicador,valor', ...indicatorRows.map((row) => row.join(','))].join('\n'));
const recalculate = (roster) => processFiles([
  { filename: 'clickup-clientes.csv', content: clickUpRosterCsv(roster) },
  { filename: 'indicadores.csv', content: indicatorCsv },
]);
const beforeSync = await recalculate([company('QuarkRH Premium', 'Maria', 'ADOÇÃO', '500', 'Ouro'), clickupOnly]);
assert.equal(beforeSync.canProcess, true, JSON.stringify(beforeSync.errors));
const afterSync = await recalculate([company('QuarkRH Essencial', 'Ana', 'ONBOARDING', '750', 'Diamante'), clickupOnly]);
assert.equal(afterSync.canProcess, true, JSON.stringify(afterSync.errors));
const beforeCustomer = beforeSync.customers.find((customer) => customer.clienteNome === 'EMPRESA TESTE');
const afterCustomer = afterSync.customers.find((customer) => customer.clienteNome === 'EMPRESA TESTE');
const unitIdentity = (customer) => customer.units.map(({ unitId, unitName }) => [unitId, unitName]);
assert.deepEqual(unitIdentity(beforeCustomer), [['10', 'Unidade Natal'], ['20', 'Unidade Mossoró']]);
assert.deepEqual(unitIdentity(afterCustomer), unitIdentity(beforeCustomer));
assert.equal(afterCustomer.units.length, 2);
assert.deepEqual(afterCustomer.units.map((unit) => unit.modules.find((module) => module.name === 'Assinatura Eletrônica').hasUsageIndicators), [true, true]);
assert.deepEqual(afterCustomer.units.map((unit) => unit.modules.find((module) => module.name === 'Assinatura Eletrônica').consolidationDetails.length), beforeCustomer.units.map((unit) => unit.modules.find((module) => module.name === 'Assinatura Eletrônica').consolidationDetails.length));
assert.equal(afterCustomer.csm, 'Ana');
assert.equal(afterCustomer.plan, 'QuarkRH Essencial');
assert.equal(afterCustomer.journey, 'ONBOARDING');
assert.equal(String(afterCustomer.mrr), '750');
assert.equal(afterCustomer.category, 'Diamante');
assert.equal(beforeCustomer.modules.find((module) => module.name === 'Assinatura Eletrônica').contractStatus, 'contratado');
assert.equal(afterCustomer.modules.find((module) => module.name === 'Assinatura Eletrônica').contractStatus, 'nao_incluso');
assert.notEqual(beforeCustomer.modules.find((module) => module.name === 'Assinatura Eletrônica').score, null);
assert.equal(afterCustomer.modules.find((module) => module.name === 'Assinatura Eletrônica').score, null);
assert.notDeepEqual(afterCustomer.contractedModules, beforeCustomer.contractedModules);
const noIndicatorsCustomer = afterSync.customers.find((customer) => customer.clienteNome === 'CLIENTE SEM PLANILHA');
assert.equal(noIndicatorsCustomer.units.length, 0);
assert.equal(noIndicatorsCustomer.unitCount, 0);

console.log('ClickUp roster tests passed: source status, precedence, conflict diagnosis, list-specific formula fields, CSV pipeline metadata, >100 pagination, spreadsheet-owned unit retention and no artificial units.');
