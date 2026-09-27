import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { FILE_TYPES, detectFileType, normalizeClientName, normalizeRows, parseWorkbook, processFiles, relateClientNames } from '../scripts/ingestion/core.mjs';
import { adoptionValue, mapRawIndicator } from '../scripts/ingestion/mapping.mjs';

const csv = (text) => Buffer.from(text, 'utf8');

const clients = parseWorkbook(csv('Task Name,6. PLANO: (drop down),11. CSM Responsável (users)\nAtlas,Enterprise,Equipe A\n'), 'clientes.csv');
assert.equal(clients.type, FILE_TYPES.CLIENTS);
assert.equal(clients.rowCount, 1);

const usage = parseWorkbook(csv('cliente_nome,indicador,valor,competencia\nAtlas,ponto_registrantes,20,2026-08\n'), 'uso.csv');
assert.equal(usage.type, FILE_TYPES.USAGE);
assert.equal(usage.errors.length, 0);

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['plano', 'modulos_contratados'], ['Enterprise', 'Frequência']]), 'Matriz');
const xlsx = parseWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), 'planos.xlsx');
assert.equal(xlsx.type, FILE_TYPES.PLANS);

const baseExport = parseWorkbook(csv('Task Name,6. PLANO: (drop down),1. JORNADA DO CLIENTE: (drop down)\nCliente Real,Premium,Em operação\n'), 'base-real.csv');
assert.equal(baseExport.type, FILE_TYPES.CLIENTS);
const planWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(planWorkbook, XLSX.utils.aoa_to_sheet([['Módulo', 'Contratado'], ['Frequência', 'Sim'], ['Férias', 'Não']]), 'QuarkRH - PREMIUM');
XLSX.utils.book_append_sheet(planWorkbook, XLSX.utils.aoa_to_sheet([['Módulo', 'Contratado'], ['Folha', 'Sim']]), 'QuarkRH - EMPRESARIAL');
const multiSheetPlans = parseWorkbook(XLSX.write(planWorkbook, { type: 'buffer', bookType: 'xlsx' }), 'matriz-real.xlsx');
assert.equal(multiSheetPlans.type, FILE_TYPES.MATRIX);
assert.deepEqual(multiSheetPlans.rows.map((row) => row.plano), ['Premium', 'Empresarial']);

const unknown = parseWorkbook(csv('coluna_a,coluna_b\n1,2\n'), 'desconhecido.csv');
assert.equal(unknown.type, FILE_TYPES.UNKNOWN);
assert.equal(unknown.errors.length, 0);

const missingName = parseWorkbook(csv('cliente_id,indicador,valor\nC1,ponto_registrantes,20\n'), 'sem-nome.csv');
assert.equal(missingName.type, FILE_TYPES.USAGE);
assert.ok(missingName.errors.some((message) => message.includes('cliente_nome')));

const normalized = normalizeRows([['Ativo', 'Valor'], ['Sim', '12,5'], ['', null]]);
assert.deepEqual(normalized.rows, [{ ativo: true, valor: 12.5 }]);
assert.equal(detectFileType(['plano', 'modulos_contratados']).type, FILE_TYPES.PLANS);
assert.equal(mapRawIndicator('Departamento Pessoal', 'qtd_setores')?.functionalId, 'sectors');
assert.equal(mapRawIndicator('Férias', 'qtd_ferias_homologadas')?.functionalId, 'vacations-moved-period');
assert.equal(mapRawIndicator('Treinamento e Desenvolvimento', 'qtd_cursos_ativos')?.functionalId, 'active-course');
assert.equal(mapRawIndicator('Folha de Pagamento', 'qtd_rubricas')?.functionalId, 'payroll-items');
assert.equal(mapRawIndicator('Benefícios', 'qtd_colaboradores_com_beneficio')?.functionalId, 'linked-employees');
assert.equal(adoptionValue('Benefícios', 'transport-voucher', 3), 3, 'valor real permanece disponível para explicabilidade');
assert.equal(adoptionValue('Benefícios', 'transport-voucher', 0), 0, 'zero conhecido permanece numérico');

const processed = await processFiles([{ filename: 'clientes.csv', content: csv('Task Name\nAtlas\n') }, { filename: 'uso.csv', content: csv('cliente_nome,modulo,indicador,valor\n atlas ,Frequência,uso,1\n') }]);
assert.equal(processed.canProcess, true);
assert.equal(processed.summary.joinStatus, 'cliente_nome_exato');
assert.equal(processed.diagnostics.relatedClientsToIndicators, 1);

const wide = await processFiles([{ filename: 'frequencia-real.csv', content: csv('cliente_nome,unidade_id,qtd_horarios,qtd_jornadas,qtd_solicitacoes,qtd_tratamento_ponto,qtd_colaboradores_registraram_ponto,configuracao_frequencia_ativa\nAtlas,U1,2,3,0,0,8,true\n') }]);
assert.equal(wide.files[0].type, 'INDICADORES_FREQUENCIA');
assert.deepEqual(wide.diagnostics.mapping[0].confirmed.map((item) => item.functionalId), ['schedules', 'journeys', 'frequency-requests', 'point-treatment', 'point-registrants', 'configuration-active']);
assert.equal(wide.diagnostics.mapping[0].absent.length, 0);

assert.equal(normalizeClientName('  CLINICA   Teste Ltda '), normalizeClientName('Clinica Teste Ltda'));
const relation = relateClientNames(
  [{ cliente_nome: 'Clinica Teste Ltda' }, { cliente_nome: 'Cliente Único' }, { cliente_nome: 'Sem Uso' }, { cliente_nome: 'DUP' }, { cliente_nome: ' dup ' }],
  [{ cliente_nome: 'clinica teste ltda' }, { cliente_nome: 'Não Encontrado' }, { cliente_nome: '' }, { cliente_nome: 'DUP' }, { cliente_nome: 'Cliente Único' }, { cliente_nome: 'Cliente Único' }],
);
assert.equal(relation.records[0].status, 'relacionado');
assert.equal(relation.records[1].status, 'cliente_nao_relacionado');
assert.equal(relation.records[2].status, 'cliente_nao_relacionado');
assert.equal(relation.records[3].status, 'cliente_ambiguo');
assert.equal(relation.records[4].status, 'relacionado');
assert.equal(relation.records[5].status, 'relacionado');
assert.deepEqual(relation.diagnostics.indicatorNamesNotFound, ['Não Encontrado', '(vazio)']);
assert.deepEqual(relation.diagnostics.ambiguousClients, ['DUP', ' dup ']);
assert.ok(relation.diagnostics.clientsWithoutIndicators.includes('Sem Uso'));
assert.notEqual(normalizeClientName('Clinica Teste'), normalizeClientName('Clinica Teste Ltda'));

console.log('Ingestion tests passed: 15 scenarios');
