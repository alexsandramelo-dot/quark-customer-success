import { adoptionMatrix } from '../../src/domain/adoption/matrix.ts';

const aliases = {
  'company-configured': ['dados_empresa_preenchidos'],
  sectors: ['qtd_setores'],
  positions: ['qtd_cargos'],
  'document-model': ['qtd_modelos_documentos'],
  'experience-evaluation': ['avaliacao_experiencia_configurada'],
  'employees-imported': ['colaboradores_ativos_importacao_true'],
  'employees-direct': ['colaboradores_ativos_importacao_false'],
  'transport-voucher': ['qtd_beneficios_vt'],
  'meal-voucher': ['qtd_beneficios_va'],
  'linked-employees': ['qtd_colaboradores_com_beneficio'],
  'payroll-configured': ['configuracao_integracao_contabil_ativa'],
  'payroll-items': ['qtd_rubricas'],
  'payroll-created-history': ['qtd_folhas'],
  'vacation-configured': ['configuracao_ferias_ativa'],
  'vacations-imported': ['qtd_ferias_cadastradas'],
  'vacations-moved-period': ['qtd_ferias_homologadas'],
  schedules: ['qtd_horarios', 'quantidade_horarios', 'horarios_cadastrados'],
  journeys: ['qtd_jornadas', 'quantidade_jornadas', 'jornadas_cadastradas'],
  'point-registrants': ['qtd_registrantes_ponto', 'qtd_colaboradores_registraram_ponto', 'colaboradores_registrando_ponto'],
  'eligible-point-employees': ['qtd_colaboradores_elegiveis', 'colaboradores_elegiveis_ponto'],
  'point-treatment': ['qtd_tratamentos_ponto', 'qtd_tratamento_ponto', 'tratamentos_ponto'],
  'frequency-requests': ['qtd_solicitacoes_frequencia', 'qtd_solicitacoes', 'solicitacoes_frequencia'],
  'configuration-active': ['configuracao_frequencia_ativa'],
  'e-sign-configured': [],
  'active-course': ['qtd_cursos_ativos'],
  'active-modules': ['qtd_modulos_ativos'],
  'active-enrollments': ['qtd_matriculas_ativas'],
  'active-enrollments-90-days': ['qtd_matriculas_ativas_90_dias'],
  'student-progress': ['qtd_aulas_assistidas'],
  certificates: ['qtd_certificados_emitidos_90_dias'],
  doctors: ['qtd_medicos'],
  'asos-configured': ['qtd_aso'],
  'medical-certificates-period': ['qtd_atestados'],
  'epi-stocks': ['qtd_estoques'],
  'epi-items': ['qtd_itens_estoque'],
  'epi-employees': ['qtd_colaboradores_com_epi'],
  'scales-configured': ['qtd_escalas'],
  'evaluation-process': ['qtd_processos'],
  'disc-configured': ['teste_comportamental_liberado'],
  'tests-answered': ['qtd_respostas'],
  'climate-survey-created': ['qtd_questionarios'],
  'communications-or-surveys': ['qtd_questionarios'],
  'published-content': ['qtd_comunicados'],
  'surveys-answered-period': ['qtd_respostas_questionario'],
  responses: ['qtd_respostas_questionario'],
  'evaluations-answered': ['qtd_resultados_avaliacao'],
  'feedback-configured': ['configuracao_feedback_ativa'],
  'praise-types': ['qtd_tipos_elogio'],
  'praises-history': ['qtd_elogios'],
  'feedbacks-history': ['qtd_feedbacks'],
  'jobs-portal': ['portal_publico_configurado'],
  'selection-stages': ['qtd_etapas_processo'],
  candidates: ['qtd_inscritos'],
  'first-document': ['data_primeiro_documento'],
  'documents-total': ['qtd_documentos_total'],
  'documents-90-days': ['qtd_documentos_90_dias'],
  'documents-finalized-90-days': ['qtd_documentos_finalizados_90_dias'],
  'active-unit-90-days': ['unidade_ativa_90_dias'],
};

const normalize = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const moduleAliases = {
  'folha_de_pagamento': 'folha',
  'treinamento_e_desenvolvimento': 't_d',
  'epi': 'gestao_de_epis',
  'avaliacao_e_desempenho': 'avaliacao_de_desempenho',
};
const module = (name) => {
  const key = normalize(name);
  const canonical = moduleAliases[key] ?? key;
  return adoptionMatrix.find((item) => normalize(item.name) === canonical);
};

export const schemaTypes = [
  ['INDICADORES_DP', 'Departamento Pessoal', ['dados_empresa_preenchidos', 'qtd_setores', 'qtd_cargos']],
  ['INDICADORES_BENEFICIOS', 'Benefícios', ['qtd_beneficios_vt', 'qtd_beneficios_va', 'qtd_colaboradores_com_beneficio']],
  ['INDICADORES_FOLHA', 'Folha', ['qtd_rubricas', 'qtd_folhas']],
  ['INDICADORES_FERIAS', 'Férias', ['qtd_ferias_cadastradas', 'qtd_ferias_homologadas']],
  ['INDICADORES_FREQUENCIA', 'Frequência', ['qtd_horarios', 'qtd_jornadas', 'qtd_colaboradores_registraram_ponto']],
  ['INDICADORES_EPI', 'Gestão de EPIs', ['qtd_itens_estoque', 'qtd_estoques', 'qtd_colaboradores_com_epi']],
  ['INDICADORES_AVALIACAO_DESEMPENHO', 'Avaliação de Desempenho', ['qtd_competencias', 'qtd_escalas', 'qtd_resultados_avaliacao']],
  ['INDICADORES_PERFIL_COMPORTAMENTAL', 'Perfil Comportamental', ['teste_comportamental_liberado', 'qtd_respostas']],
  ['INDICADORES_COMUNICACAO', 'Comunicação', ['qtd_comunicados', 'qtd_questionarios', 'qtd_respostas_questionario']],
  ['INDICADORES_PESQUISA_CLIMA', 'Pesquisa de Clima', ['qtd_questionarios', 'qtd_respostas_questionario']],
  ['INDICADORES_FEEDBACKS', 'Feedbacks', ['qtd_elogios', 'qtd_tipos_elogio', 'qtd_feedbacks']],
  ['INDICADORES_RS', 'Recrutamento e Seleção', ['portal_publico_configurado', 'qtd_etapas_processo', 'qtd_inscritos']],
  ['INDICADORES_SAUDE_OCUPACIONAL', 'Saúde Ocupacional', ['qtd_aso', 'qtd_atestados', 'qtd_medicos']],
];

export function detectIndicatorSchema(headers) {
  const normalized = new Set(headers.map(normalize));
  const matches = schemaTypes.filter(([, , required]) => required.filter((column) => normalized.has(normalize(column))).length >= 2);
  if (matches.length === 1) return { type: matches[0][0], module: matches[0][1], confidence: 'alta' };
  if (matches.length > 1 && matches.some((match) => match[0] === 'INDICADORES_COMUNICACAO') && matches.some((match) => match[0] === 'INDICADORES_PESQUISA_CLIMA')) return { type: 'NAO_IDENTIFICADO', module: null, confidence: 'baixa', reason: 'Comunicação e Pesquisa de Clima compartilham colunas; schema complementar é necessário.' };
  return matches.length ? { type: matches[0][0], module: matches[0][1], confidence: 'media' } : null;
}

export function mapRawIndicator(moduleName, rawName) {
  const raw = normalize(rawName);
  const definition = module(moduleName);
  const rule = definition?.rules.find((item) => normalize(item.id) === raw || aliases[item.id]?.map(normalize).includes(raw));
  if (rule) return { functionalId: rule.id, label: rule.label, status: 'CONFIRMADO', sourceColumn: rawName, weight: rule.weight };
  const componentRule = definition?.rules.find((item) => [item.numeratorId, item.denominatorId].some((id) => id && (normalize(id) === raw || aliases[id]?.map(normalize).includes(raw))));
  const useNumerator = componentRule && (normalize(componentRule.numeratorId) === raw || aliases[componentRule.numeratorId]?.map(normalize).includes(raw));
  const componentId = useNumerator ? componentRule.numeratorId : componentRule?.denominatorId;
  const componentParent = definition?.rules.find((item) => item.kind === 'sum' && item.componentIds?.some((id) => normalize(id) === raw || aliases[id]?.map(normalize).includes(raw)));
  const componentFunctionalId = componentParent?.componentIds?.find((id) => normalize(id) === raw || aliases[id]?.map(normalize).includes(raw));
  if (componentParent && componentFunctionalId) return { functionalId: componentFunctionalId, label: `${componentParent.label} · ${componentFunctionalId}`, status: 'CONFIRMADO', sourceColumn: rawName, weight: componentParent.weight };
  return componentRule && componentId ? { functionalId: componentId, label: `${componentRule.label} · ${componentId}`, status: 'CONFIRMADO', sourceColumn: rawName, weight: componentRule.weight } : null;
}

export function adoptionValue(moduleName, functionalId, value) {
  const rule = module(moduleName)?.rules.find((item) => item.id === functionalId);
  if (rule?.kind === 'boolean' && typeof value === 'number') return value > 0;
  return value;
}

export function mapRawIndicatorAny(rawName) {
  for (const definition of adoptionMatrix) {
    const mapped = mapRawIndicator(definition.name, rawName);
    if (mapped) return { ...mapped, module: definition.name };
  }
  return null;
}

export function hasKnownIndicatorColumn(headers) {
  return headers.some((header) => Boolean(mapRawIndicatorAny(header)));
}

export function mapIndicatorColumns(headers, moduleName) {
  const reserved = new Set(['cliente_nome', 'cliente', 'nome_cliente', 'unidade_id', 'modulo', 'modulos', 'competencia', 'periodo', 'mes', 'indicador', 'valor']);
  return headers.filter((header) => !reserved.has(normalize(header))).map((header) => mapRawIndicator(moduleName, header)).filter(Boolean);
}

export function mappingForModule(moduleName, rawIndicators) {
  const definition = module(moduleName);
  const uniqueRawIndicators = [...new Set(rawIndicators)];
  const mappings = uniqueRawIndicators.map((indicator) => mapRawIndicator(moduleName, indicator)).filter(Boolean);
  const uniqueMappings = [...new Map(mappings.map((item) => [item.functionalId, item])).values()];
  const confirmed = new Set(uniqueMappings.map((item) => item.functionalId));
  const isPresent = (rule) => rule.kind === 'sum' ? (rule.componentIds ?? []).every((id) => confirmed.has(id)) : confirmed.has(rule.id);
  return { module: moduleName, confirmed: uniqueMappings, absent: (definition?.rules ?? []).filter((rule) => !isPresent(rule)).map((rule) => ({ functionalId: rule.id, label: rule.label, weight: rule.weight, status: 'DADO AUSENTE' })), unmapped: uniqueRawIndicators.filter((indicator) => !mapRawIndicator(moduleName, indicator)) };
}
