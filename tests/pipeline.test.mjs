import assert from 'node:assert/strict';
import { processFiles } from '../scripts/ingestion/core.mjs';

const fixtures = {
  'clientes.csv': 'Task Name,6. PLANO: (drop down),1. JORNADA DO CLIENTE: (drop down),11. CSM Responsável (users)\nCliente A,Premium,Em operação,Marina\nCliente B,Frequência Básico,Implantação,Rafael\nCliente C,,Em operação,João\n',
  'planos.csv': 'plano,modulos_contratados\nEnterprise,Frequência|Férias\nStarter,Frequência\n',
  'indicadores-a.csv': 'cliente_nome,modulo,indicador,valor\n Cliente A ,Frequência,configuracao_de_frequencia_ativa,true\nCliente A,Frequência,possui_horarios,true\nCliente A,Frequência,possui_jornadas,true\nCliente A,Frequência,colaboradores_registrando_ponto,8\nCliente A,Frequência,colaboradores_elegiveis,10\nCliente A,Frequência,existe_tratamento_de_ponto,true\nCliente A,Frequência,existem_solicitacoes_de_frequencia,true\nCliente B,Frequência,colaboradores_registrando_ponto,0\nCliente B,Frequência,colaboradores_elegiveis,10\n',
  'indicadores-b.csv': 'cliente_nome,modulo,indicador,valor\nCliente A,Férias,solicitacoes,2\nCliente B,Frequência,possui_horarios,false\n',
};
const result = await processFiles(Object.entries(fixtures).map(([filename, content]) => ({ filename, content: Buffer.from(content) })));

assert.equal(result.canProcess, true);
assert.equal(result.customers.length, 3);
const clienteA = result.customers.find((customer) => customer.clienteNome === 'Cliente A');
const clienteB = result.customers.find((customer) => customer.clienteNome === 'Cliente B');
const clienteC = result.customers.find((customer) => customer.clienteNome === 'Cliente C');
assert.equal(clienteA.contractedModules.length, 18);
assert.ok(clienteA.contractedModules.includes('Frequência'));
assert.equal(clienteA.modules.find((module) => module.name === 'Frequência').score, null);
assert.equal(clienteA.modules.find((module) => module.name === 'Frequência').consolidationDetails.find((indicator) => indicator.indicator === 'configuracao_de_frequencia_ativa').reason, 'Indicador sem regra de consolidação definida na matriz.');
assert.equal(clienteA.overallScore, null);
assert.equal(clienteA.evaluatedModules, 0);
assert.equal(clienteA.insufficientModules, 18);
assert.equal(clienteB.modules.length, 18);
assert.ok(clienteB.modules.some((module) => module.name === 'Frequência'));
assert.equal(clienteB.modules[0].score, null);
assert.equal(clienteB.modules.filter((module) => module.status === 'dados_insuficientes').length, 5);
assert.equal(clienteC.planStatus, 'plano_nao_informado');
assert.equal(result.diagnostics.indicatorFilesProcessed, 2);
assert.equal(result.diagnostics.plansFound, 10);
assert.equal(result.summary.joinStatus, 'cliente_nome_exato');

console.log('Pipeline end-to-end tests passed: arquivo -> cliente -> plano -> módulo -> indicador -> score -> API');
