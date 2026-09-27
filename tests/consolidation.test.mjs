import assert from 'node:assert/strict';
import { consolidateIndicator, findConsolidationRule, findSemanticDerivedMetric, loadConsolidationMatrix, normalizeRule } from '../scripts/ingestion/consolidation.mjs';
import { parseWorkbook, processFiles } from '../scripts/ingestion/core.mjs';
import { mapRawIndicator } from '../scripts/ingestion/mapping.mjs';

const matrix = loadConsolidationMatrix();
assert.equal(matrix.diagnostics.rows, 122);
assert.equal(matrix.diagnostics.modules, 15);
assert.equal(matrix.diagnostics.counts.SOMAR, 83);
assert.equal(matrix.diagnostics.counts.ANY, 9);
assert.equal(matrix.diagnostics.counts.RECALCULAR, 11);
assert.equal(matrix.diagnostics.counts.MAX, 1);
assert.equal(matrix.diagnostics.counts.MIN, 2);
assert.equal(matrix.diagnostics.counts['NÃO SOMAR AUTOMATICAMENTE'], 12);
assert.equal(matrix.diagnostics.counts['REVISAR REGRA'], 1);
assert.equal(matrix.diagnostics.counts['NÃO CONSOLIDAR'], 2);
assert.equal(findConsolidationRule(matrix, 'T&D', 'qtd_matriculas_ativas').rule, 'SOMAR');
assert.equal(findConsolidationRule(matrix, 'T&D', 'qtd_cursos_ativos').rule, 'SOMAR');
assert.equal(findConsolidationRule(matrix, 'T&D', 'qtd_usuarios_ativos').rule, 'NÃO SOMAR AUTOMATICAMENTE');
assert.equal(findConsolidationRule(matrix, 'Assinatura Eletrônica', 'qtd_participantes_ativos').rule, 'NÃO SOMAR AUTOMATICAMENTE');
assert.equal(findConsolidationRule(matrix, 'Folha', 'configuracao_integracao_contabil_ativa').rule, 'ANY');
assert.equal(findConsolidationRule(matrix, 'Gestão de EPIs', 'qtd_itens_estoque').rule, 'SOMAR');
assert.equal(findConsolidationRule(matrix, 'Gestão de EPIs', 'qtd_estoques').rule, 'SOMAR');
assert.equal(findConsolidationRule(matrix, 'Gestão de EPIs', 'qtd_colaboradores_com_epi').rule, 'SOMAR');
assert.equal(findConsolidationRule(matrix, 'Departamento Pessoal', 'colaboradores_ativos_importacao_true').rule, 'SOMAR');
assert.equal(findConsolidationRule(matrix, 'Frequência', 'qtd_colaboradores_registraram_ponto').rule, 'RECALCULAR');
assert.equal(findSemanticDerivedMetric('Frequência', 'qtd_colaboradores_registraram_ponto').operation, 'RECALCULAR');
assert.equal(findConsolidationRule(matrix, 'Departamento Pessoal', 'colaboradores_ativos_importacao_false').rule, 'SOMAR');
assert.equal(findConsolidationRule(matrix, 'Benefícios', 'qtd_colaboradores_com_beneficio').rule, 'SOMAR');
assert.equal(findConsolidationRule(matrix, 'Departamento Pessoal', 'dados_empresa_preenchidos').rule, 'ANY');
assert.equal(mapRawIndicator('Pesquisa de Clima', 'qtd_respostas_questionario').functionalId, 'responses');
assert.equal(mapRawIndicator('Avaliação de Desempenho', 'qtd_resultados_avaliacao').functionalId, 'evaluations-answered');
assert.equal(mapRawIndicator('Avaliação de Desempenho', 'evaluations-answered').functionalId, 'evaluations-answered');
assert.equal(mapRawIndicator('Pesquisa de Clima', 'responses').functionalId, 'responses');
assert.equal(normalizeRule('MÁXIMO/DATA MAIS RECENTE'), 'MAX');
const wideMatrixFile = parseWorkbook(Buffer.from('cliente_id,cliente_nome,unidade_id,unidade_nome,qtd_matriculas_ativas\n1,Cliente Matriz,10,Natal,2'), 'modulo_treinamento_desenvolvimento.csv');
assert.equal(wideMatrixFile.type, 'INDICADORES_DE_USO');
assert.deepEqual(wideMatrixFile.errors, []);

const observations = (values) => values.map((value, index) => ({ unitId: String(index + 1), unitName: `Unidade ${index + 1}`, value }));
const sum = consolidateIndicator('SOMAR', observations([10, 20, 30]));
assert.equal(sum.value, 60);
assert.equal(consolidateIndicator('SOMAR', observations([0, 0])).value, 0);
const missingSum = consolidateIndicator('SOMAR', observations([10, null, 30]));
assert.equal(missingSum.value, null);
assert.equal(missingSum.knownSubtotal, 40);
assert.match(missingSum.reason, /não foi tratada como zero/);

assert.equal(consolidateIndicator('ANY', observations([false, true, false])).value, true);
assert.equal(consolidateIndicator('ANY (se regra funcional = cliente usa)', observations([false, 'true', false])).value, true);
assert.equal(consolidateIndicator('ANY (se regra funcional = cliente usa)', observations([0, 4, 0])).value, true);
assert.equal(consolidateIndicator('ANY', observations([null, null])).value, null);
assert.equal(consolidateIndicator('ANY', observations([false, false])).value, false);

const recalculateRule = findConsolidationRule(matrix, 'Treinamento e Desenvolvimento', 'taxa_certificacao_sobre_matriculas_ativas_percentual');
const recalculated = consolidateIndicator(recalculateRule.rule, observations([80, 50]), { components: [{ numerator: 80, denominator: 100 }, { numerator: 10, denominator: 20 }] });
assert.equal(recalculated.numerator, 90);
assert.equal(recalculated.denominator, 120);
assert.equal(recalculated.value, 75);
assert.notEqual(recalculated.value, (80 + 50) / 2);
assert.equal(consolidateIndicator('RECALCULAR', observations([80, 50])).value, null);
assert.equal(consolidateIndicator('RECALCULAR', observations([0, 0]), { components: [{ numerator: 0, denominator: 0 }, { numerator: 0, denominator: 0 }] }).value, null);
assert.equal(consolidateIndicator('RECALCULAR', observations([0, 0]), { components: [{ numerator: 0, denominator: 0 }, { numerator: 0, denominator: 0 }] }).denominator, 0, 'known zero denominator remains available as evidence');

assert.equal(consolidateIndicator('MÁXIMO / DATA MAIS RECENTE', observations(['2026-07-10', null, '2026-08-25'])).value, '2026-08-25');
assert.equal(consolidateIndicator('MÁXIMO / DATA MAIS RECENTE', observations([null, null])).value, null);
assert.equal(consolidateIndicator('MÁXIMO/DATA MAIS RECENTE', observations(['2026-08-25', 'data inválida'])).value, null);
assert.equal(consolidateIndicator('MIN', observations(['2026-07-10T10:00:00', '2026-06-25T11:00:00'])).value, '2026-06-25T11:00:00');
assert.equal(consolidateIndicator('MAX', observations(['2026-07-10T10:00:00', '2026-08-25T11:00:00'])).value, '2026-08-25T11:00:00');
const weighted = consolidateIndicator('MÉDIA PONDERADA', observations([10, 20]), { components: [{ numerator: 10, denominator: 2 }, { numerator: 80, denominator: 8 }] });
assert.equal(weighted.numerator, 90);
assert.equal(weighted.denominator, 10);
assert.equal(weighted.value, 9);
assert.equal(consolidateIndicator('NÃO CONSOLIDAR', observations([4, 6])).value, null);
assert.equal(findSemanticDerivedMetric('T&D', 'media_aulas_por_curso').operation, 'MÉDIA PONDERADA');
const duplicateRisk = consolidateIndicator('NÃO SOMAR AUTOMATICAMENTE', observations([100, 100]));
assert.equal(duplicateRisk.value, null);
assert.match(duplicateRisk.reason, /identificadores individuais/);
const review = consolidateIndicator('REVISAR REGRA', observations([1, 2]));
assert.equal(review.value, null);
assert.match(review.reason, /ainda não definida/);
assert.equal(consolidateIndicator(undefined, observations([5])).value, null);
assert.equal(sum.evidence[0].unitName, 'Unidade 1');

const base = 'Task Name,11. CSM Responsável (users),6. PLANO: (drop down)\nCliente Matriz,CSM,QuarkRH Essencial';
const sourceRows = [
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','taxa_certificacao_sobre_matriculas_ativas_percentual','80'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','taxa_certificacao_sobre_matriculas_ativas_percentual','50'],
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','qtd_certificados_ativos','10'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','qtd_certificados_ativos','5'],
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','qtd_matriculas_ativas','100'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','qtd_matriculas_ativas','50'],
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','qtd_matriculas_ativadas_90_dias','10'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','qtd_matriculas_ativadas_90_dias','30'],
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','qtd_matriculas_90_dias','20'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','qtd_matriculas_90_dias','100'],
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','qtd_aulas_disponibilizadas','20'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','qtd_aulas_disponibilizadas','80'],
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','media_aulas_por_curso','10'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','media_aulas_por_curso','10'],
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','taxa_ativacao_matriculas_percentual','50'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','taxa_ativacao_matriculas_percentual','90'],
  ['Cliente Matriz','11','Natal','Treinamento e Desenvolvimento','qtd_cursos_ativos','2'],
  ['Cliente Matriz','12','Recife','Treinamento e Desenvolvimento','qtd_cursos_ativos','8'],
  ['Cliente Matriz','11','Natal','Assinatura Eletrônica','data_ultimo_documento','2026-07-10'],
  ['Cliente Matriz','12','Recife','Assinatura Eletrônica','data_ultimo_documento','2026-08-25'],
  ['Cliente Matriz','11','Natal','Assinatura Eletrônica','data_primeiro_documento','2026-01-02'],
  ['Cliente Matriz','12','Recife','Assinatura Eletrônica','data_primeiro_documento','2026-01-01'],
  ['Cliente Matriz','11','Natal','Assinatura Eletrônica','horas_mediana_ate_finalizacao','4'],
  ['Cliente Matriz','12','Recife','Assinatura Eletrônica','horas_mediana_ate_finalizacao','6'],
  ['Cliente Matriz','11','Natal','Departamento Pessoal','indicador_nao_mapeado','7'],
];
const source = ['cliente_nome,unidade_id,unidade_nome,modulo,indicador,valor', ...sourceRows.map((row) => row.join(','))].join('\n');
const imported = await processFiles([{ filename: 'clientes.csv', content: Buffer.from(base) }, { filename: 'indicadores.csv', content: Buffer.from(source) }]);
const customer = imported.customers[0];
const module = (name) => customer.modules.find((item) => item.name === name);
const detail = (name, indicator) => module(name).consolidationDetails.find((item) => item.indicator === indicator);
assert.equal(customer.unitCount, 2);
assert.equal(customer.modules.length, 18);
assert.equal(detail('T&D', 'taxa_certificacao_sobre_matriculas_ativas_percentual').rule, 'RECALCULAR');
assert.equal(detail('T&D', 'taxa_certificacao_sobre_matriculas_ativas_percentual').consolidatedValue, 10);
assert.equal(detail('T&D', 'taxa_certificacao_sobre_matriculas_ativas_percentual').numerator, 15);
assert.equal(detail('T&D', 'taxa_certificacao_sobre_matriculas_ativas_percentual').denominator, 150);
assert.notEqual(detail('T&D', 'taxa_certificacao_sobre_matriculas_ativas_percentual').consolidatedValue, (80 + 50) / 2);
assert.ok(Math.abs(detail('T&D', 'taxa_ativacao_matriculas_percentual').consolidatedValue - 100 / 3) < 1e-12);
assert.equal(detail('T&D', 'media_aulas_por_curso').numerator, 100);
assert.equal(detail('T&D', 'media_aulas_por_curso').denominator, 10);
assert.equal(detail('T&D', 'media_aulas_por_curso').consolidatedValue, 10);
assert.equal(module('T&D').score, null);
assert.equal(detail('Assinatura Eletrônica', 'data_ultimo_documento').consolidatedValue, '2026-08-25');
assert.equal(detail('Assinatura Eletrônica', 'data_primeiro_documento').rule, 'MIN');
assert.equal(detail('Assinatura Eletrônica', 'data_primeiro_documento').consolidatedValue, '2026-01-01');
assert.equal(detail('Assinatura Eletrônica', 'horas_mediana_ate_finalizacao').rule, 'NÃO CONSOLIDAR');
assert.equal(detail('Assinatura Eletrônica', 'horas_mediana_ate_finalizacao').consolidatedValue, null);
assert.equal(detail('Departamento Pessoal', 'indicador_nao_mapeado').rule, null);
assert.equal(detail('Departamento Pessoal', 'indicador_nao_mapeado').status, 'dados_insuficientes');
assert.equal(detail('Departamento Pessoal', 'indicador_nao_mapeado').reason, 'Indicador sem regra de consolidação definida na matriz.');
assert.equal(imported.diagnostics.consolidationMatrix.rows, 122);
assert.equal(imported.summary.matrixStatus, 'carregada_do_projeto');

console.log('Consolidation operation tests passed: SUM, ANY, RECOMPUTE, latest date, blocked and unknown rules');
