import assert from 'node:assert/strict';
import { processFiles } from '../scripts/ingestion/core.mjs';

const clientCsv = [
  'Task Name,11. CSM Responsável (users),6. PLANO: (drop down)',
  'Cliente Base,CSM Base,QuarkRH Essencial',
  'Cliente sem plano,CSM sem plano,',
  'Cliente sem dados,CSM sem dados,',
  'Plano desconhecido,CSM desconhecido,Plano Customizado',
].join('\n');
const values = [
  ...['feedback-configured', 'praise-types', 'praises-history', 'feedbacks-history', 'feedbacks-period', 'praises-period'].map(id => `Cliente Base,Feedbacks,${id},0`),
  ...['active-course', 'enrolled-students', 'student-progress', 'certificates'].map(id => `Cliente Base,T&D,${id},1`),
  'Cliente sem plano,Feedbacks,feedbacks-period,78',
  'Cliente sem plano,Feedbacks,feedback-configured,',
  'Plano desconhecido,Feedbacks,feedbacks-period,45',
].join('\n');
const result = await processFiles([
  { filename: 'clientes.csv', content: Buffer.from(clientCsv) },
  { filename: 'uso.csv', content: Buffer.from(`cliente_nome,modulo,indicador,valor\n${values}`) },
]);
assert.equal(result.canProcess, true);
assert.equal(result.customers.length, 4);
const base = result.customers.find(customer => customer.clienteNome === 'Cliente Base');
const noPlan = result.customers.find(customer => customer.clienteNome === 'Cliente sem plano');
const unknown = result.customers.find(customer => customer.clienteNome === 'Plano desconhecido');
const noData = result.customers.find(customer => customer.clienteNome === 'Cliente sem dados');

// Known plan: included modules are evaluated, while non-included module use remains visible.
assert.equal(base.modules.length, 18);
assert.equal(base.modules.find(module => module.name === 'Feedbacks').contractStatus, 'contratado');
assert.equal(base.modules.find(module => module.name === 'Feedbacks').score, null); // indicators absent from the consolidation matrix stay insufficient in consolidated scope
assert.equal(base.modules.find(module => module.name === 'Feedbacks').hasUsageIndicators, true);
assert.equal(base.modules.find(module => module.name === 'Folha').status, 'dados_insuficientes');
assert.equal(base.modules.find(module => module.name === 'Folha').score, null);
assert.equal(base.modules.find(module => module.name === 'T&D').contractStatus, 'nao_incluso');
assert.equal(base.modules.find(module => module.name === 'T&D').score, null);
assert.equal(base.modules.find(module => module.name === 'Assinatura Eletrônica').contractStatus, 'nao_incluso');
assert.equal(base.modules.find(module => module.name === 'Assinatura Eletrônica').status, 'nao_contratado');
assert.equal(base.overallScore, null); // no contracted consolidated module has a matrix-backed calculable score

// Empty and unknown plans retain every module and never infer contract from usage.
assert.equal(noPlan.planStatus, 'plano_nao_informado');
assert.equal(noPlan.overallScore, null);
assert.equal(noPlan.modules.length, 18);
assert.ok(noPlan.modules.every(module => module.contractStatus === 'plano_nao_informado'));
assert.equal(noPlan.modules.find(module => module.name === 'Feedbacks').hasUsageIndicators, true);
assert.equal(noPlan.modules.find(module => module.name === 'Feedbacks').status, 'dados_insuficientes');
assert.equal(noPlan.modules.find(module => module.name === 'Feedbacks').indicators.find(indicator => indicator.id === 'feedback-configured').status, 'dados_insuficientes');
assert.equal(noPlan.modules.find(module => module.name === 'Folha').status, 'dados_insuficientes');
assert.equal(noData.overallScore, null);
assert.equal(noData.modules.length, 18);
assert.ok(noData.modules.every(module => module.status === 'dados_insuficientes' || module.status === 'nao_contratado'));
assert.equal(unknown.planStatus, 'plano_nao_mapeado');
assert.ok(unknown.modules.every(module => module.contractStatus === 'plano_nao_mapeado'));
assert.equal(unknown.modules.find(module => module.name === 'Feedbacks').hasUsageIndicators, true);

// The real spreadsheet headers populate only their corresponding normalized fields.
const headerFile = result.files.find(file => file.filename === 'clientes.csv');
assert.ok(headerFile.headers.includes('task_name'));
assert.ok(headerFile.headers.includes('11_csm_responsavel_users'));
assert.ok(headerFile.headers.includes('6_plano_drop_down'));
assert.equal(base.csm, 'CSM Base');
assert.equal(base.plan, 'QuarkRH Essencial');
assert.equal(base.clienteNome, 'Cliente Base');
assert.equal(base.cliente_nome, 'Cliente Base');
assert.equal(base.csm_responsavel, 'CSM Base');
assert.equal(base.plano, 'QuarkRH Essencial');
assert.equal(noPlan.plano, null);
assert.equal(result.diagnostics.clientCount, 4);
assert.equal(result.diagnostics.clientsWithCsm, 4);
assert.equal(result.diagnostics.clientsWithPlan, 2);

console.log('Customer contract/usage tests passed: 22 checks');
