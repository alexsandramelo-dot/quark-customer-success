import * as XLSX from 'xlsx';
import { adoptionValue, detectIndicatorSchema, hasKnownIndicatorColumn, mapRawIndicator, mapRawIndicatorAny, mappingForModule } from './mapping.mjs';
import { fixedPlanNames, modulesForPlan, normalizePlanName } from '../../src/domain/plans/planModules.ts';
import { adoptionMatrix } from '../../src/domain/adoption/matrix.ts';
import { calculateAdoptionModule, classifyAdoption } from '../../src/domain/adoption/engine.ts';
import { consolidateIndicator, consolidationModuleKey, findConsolidationRule, findSemanticDerivedMetric, loadConsolidationMatrix, normalizeConsolidationKey, normalizeRule } from './consolidation.mjs';

export const FILE_TYPES = {
  CLIENTS: 'BASE_CLIENTES',
  PLANS: 'MATRIZ_PLANOS',
  USAGE: 'INDICADORES_DE_USO',
  MATRIX: 'MATRIZ_PLANOS',
  UNKNOWN: 'NAO_IDENTIFICADO',
};
const indicatorTypes = new Set(['INDICADORES_DE_USO', 'INDICADORES_DP', 'INDICADORES_BENEFICIOS', 'INDICADORES_FOLHA', 'INDICADORES_FERIAS', 'INDICADORES_FREQUENCIA', 'INDICADORES_EPI', 'INDICADORES_AVALIACAO_DESEMPENHO', 'INDICADORES_PERFIL_COMPORTAMENTAL', 'INDICADORES_COMUNICACAO', 'INDICADORES_PESQUISA_CLIMA', 'INDICADORES_FEEDBACKS', 'INDICADORES_RS', 'INDICADORES_SAUDE_OCUPACIONAL']);
const isIndicatorFile = (file) => indicatorTypes.has(file.type);

const aliases = {
  clientId: ['cliente_id', 'id_cliente', 'client_id', 'codigo_cliente', 'unidade_id'],
  clientName: ['task_name', 'cliente_nome', 'cliente', 'nome_cliente', 'client', 'nome_da_empresa', 'empresa'],
  plan: ['plano', 'plan', 'nome_plano', '6_plano_drop_down', '6_plano'],
  modules: ['modulos', 'modulos_contratados', 'módulos', 'módulos_contratados', 'module', 'modulo'],
  indicator: ['indicador', 'indicator', 'metrica', 'métrica', 'kpi'],
  value: ['valor', 'value', 'resultado', 'quantidade', 'percentual', 'percentual_valor'],
  competence: ['competencia', 'competência', 'periodo', 'período', 'mes', 'mês'],
  journey: ['jornada', 'journey', '1_jornada_do_cliente_drop_down'],
  csm: ['11_csm_responsavel_users', 'csm_responsavel', 'csm', 'responsavel', 'responsável'],
  signedAt: ['data_assinatura', 'assinatura', 'signed_at', '7_data_de_assinatura_date'],
  mrr: ['mrr', '5_mrr_currency'],
  category: ['categoria', 'categoria_rh', '9_categoria_rh_formula'],
  goLiveAt: ['go_live', 'data_go_live', 'virada_de_chave', '17_data_de_virada_chave_date'],
};

function parseClientSourceConflicts(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

const fold = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
export const normalizeHeader = fold;
const indicatorMetadataColumns = new Set([...aliases.clientId, ...aliases.clientName, ...aliases.modules, ...aliases.indicator, ...aliases.value, ...aliases.competence, ...aliases.journey, ...aliases.csm, ...aliases.signedAt, ...aliases.mrr, ...aliases.category, ...aliases.goLiveAt, 'unidade_id', 'unit_id', 'unidade_nome', 'unit_name'].map(fold));
export function normalizeClientName(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');
}

const findAlias = (headers, names) => headers.find((header) => names.map(fold).includes(header));
const hasAny = (headers, names) => Boolean(findAlias(headers, names));

function parseValue(value, header) {
  if (value === '' || value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return null;
  if (header === 'cliente_nome') return value;
  if (['ativo', 'active', 'sim', 'yes', 'true'].includes(fold(text))) return true;
  if (['inativo', 'inactive', 'nao', 'no', 'false'].includes(fold(text))) return false;
  const numericHeader = /(^|_)(valor|value|quantidade|percentual|score|total|count|qtd)($|_)/.test(header);
  if ((numericHeader || aliases.mrr.map(fold).includes(header)) && /^-?\d+(?:[,.]\d+)?$/.test(text)) return Number(text.replace(',', '.'));
  return text;
}

export function normalizeRows(rows) {
  const sourceHeaders = (rows[0] ?? []).map((value) => normalizeHeader(value));
  const headers = sourceHeaders.map((value, index) => value || `coluna_${index + 1}`);
  const normalized = rows.slice(1).filter((row) => row.some((value) => value !== null && value !== undefined && String(value).trim() !== '')).map((row) => Object.fromEntries(headers.map((header, index) => [header, parseValue(row[index], header)])));
  return { headers, rows: normalized };
}

export function worksheetToRows(sheet) {
  const populated = new Map();
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue;
    const cell = sheet[address];
    if (!cell || cell.v === undefined || cell.v === null || String(cell.v).trim() === '') continue;
    const { r, c } = XLSX.utils.decode_cell(address);
    let row = populated.get(r);
    if (!row) populated.set(r, row = new Map());
    row.set(c, typeof cell.v === 'string' ? cell.v : XLSX.utils.format_cell(cell));
  }
  return [...populated.entries()].sort(([a], [b]) => a - b).map(([, cells]) => {
    const row = Array(Math.max(...cells.keys()) + 1).fill(null);
    for (const [column, value] of cells) row[column] = value;
    return row;
  });
}

function declaredWorksheetRowCount(sheet) {
  if (!sheet['!ref']) return 0;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  return range.e.r - range.s.r + 1;
}

export function normalizeWorksheet(worksheet) {
  const rawRows = worksheetToRows(worksheet);
  const preliminaryHeaders = (rawRows[0] ?? []).map((value) => normalizeHeader(value));
  const detectedType = detectFileType(preliminaryHeaders).type;
  const dataRows = rawRows.slice(1);
  const taskNameIndex = preliminaryHeaders.indexOf('task_name');
  const usefulRows = detectedType === FILE_TYPES.CLIENTS
    ? dataRows.filter((row) => taskNameIndex >= 0 && row[taskNameIndex] !== null && row[taskNameIndex] !== undefined && String(row[taskNameIndex]).trim() !== '')
    : dataRows;
  return { ...normalizeRows([rawRows[0] ?? [], ...usefulRows]), declaredRowCount: declaredWorksheetRowCount(worksheet) };
}

export function detectFileType(headers, filename = '') {
  const indicatorSchema = detectIndicatorSchema(headers);
  if (indicatorSchema?.module) return { type: indicatorSchema.type, module: indicatorSchema.module, confidence: indicatorSchema.confidence, reason: 'Schema de indicadores reconhecido.' };
  const matrix = loadConsolidationMatrix();
  const matrixIndicators = new Map();
  for (const header of headers) {
    for (const rule of matrix.rules) if (normalizeHeader(rule.indicator) === normalizeHeader(header)) matrixIndicators.set(consolidationModuleKey(rule.module), rule.module);
  }
  const filenameKey = consolidationModuleKey(filename);
  const filenameModule = filenameKey ? matrix.rules.map((rule) => rule.module).find((module) => filenameKey.includes(consolidationModuleKey(module))) : null;
  const matrixModule = filenameModule && matrixIndicators.has(consolidationModuleKey(filenameModule)) ? filenameModule : matrixIndicators.size === 1 ? [...matrixIndicators.values()][0] : null;
  if (matrixIndicators.size > 0) return { type: FILE_TYPES.USAGE, module: matrixModule, confidence: matrixModule ? 'alta' : 'baixa', reason: matrixModule ? 'Indicadores correspondem exatamente à matriz funcional.' : 'Indicadores da matriz encontrados, mas o módulo do arquivo é ambíguo.' };
  if (indicatorSchema) return { type: indicatorSchema.type, module: indicatorSchema.module, confidence: indicatorSchema.confidence, reason: indicatorSchema.reason ?? 'Schema de indicadores reconhecido.' };
  const hasClient = hasAny(headers, aliases.clientId) || hasAny(headers, aliases.clientName);
  const hasPlan = hasAny(headers, aliases.plan);
  const hasModules = hasAny(headers, aliases.modules);
  const hasIndicator = hasAny(headers, aliases.indicator) || hasAny(headers, aliases.value) || hasKnownIndicatorColumn(headers);
  if (hasPlan && hasModules) return { type: FILE_TYPES.MATRIX, confidence: 'alta', reason: 'Plano e módulos contratados identificados.' };
  if (hasClient && hasIndicator) return { type: FILE_TYPES.USAGE, confidence: 'alta', reason: 'Cliente e indicador/valor identificados.' };
  if (hasClient && !hasModules && !hasIndicator) return { type: FILE_TYPES.CLIENTS, confidence: 'media', reason: 'Identificador ou nome de cliente identificado.' };
  return { type: FILE_TYPES.UNKNOWN, confidence: 'baixa', reason: 'As colunas não permitem identificar uma origem conhecida sem hipótese.' };
}

function requiredValidation(type, headers) {
  const errors = [];
  const warnings = [];
  if (type === FILE_TYPES.CLIENTS && !headers.includes('task_name')) errors.push('Base de clientes sem a coluna Task Name, usada como cliente_nome.');
  if (type === FILE_TYPES.CLIENTS && !headers.includes('11_csm_responsavel_users')) warnings.push('Coluna 11. CSM Responsável (users) não identificada; CSM será mantido como null.');
  if (type === FILE_TYPES.CLIENTS && !headers.includes('6_plano_drop_down')) warnings.push('Coluna 6. PLANO: (drop down) não identificada; plano será mantido como null.');
  if (type === FILE_TYPES.PLANS && !hasAny(headers, aliases.plan)) errors.push('Matriz de planos sem coluna de plano.');
  if (type === FILE_TYPES.PLANS && !hasAny(headers, aliases.modules)) errors.push('Matriz de planos sem coluna de módulos contratados.');
  if (isIndicatorFile({ type }) && !hasAny(headers, aliases.clientName)) errors.push('Indicadores sem cliente_nome.');
  const matrixIndicators = new Set(loadConsolidationMatrix().rules.map((rule) => normalizeHeader(rule.indicator)));
  const hasMatrixIndicatorColumn = headers.some((header) => matrixIndicators.has(normalizeHeader(header)));
  if (isIndicatorFile({ type }) && !hasAny(headers, aliases.indicator) && !hasAny(headers, aliases.value) && !hasKnownIndicatorColumn(headers) && !hasMatrixIndicatorColumn) errors.push('Indicadores sem coluna de indicador ou valor reconhecível.');
  if (isIndicatorFile({ type }) && !hasAny(headers, aliases.competence)) warnings.push('Competência não informada; o lote não poderá ser comparado temporalmente com segurança.');
  return { errors, warnings };
}

export function parseWorkbook(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true, cellDates: false, codepage: 65001 });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error('Arquivo sem planilha legível.');
  const sheets = workbook.SheetNames.map((name) => ({ name, ...normalizeWorksheet(workbook.Sheets[name]) }));
  if (!sheets.some((sheet) => sheet.rows.length || sheet.headers.length)) throw new Error('Arquivo vazio.');
  const matrixSheets = sheets.filter((sheet) => hasAny(sheet.headers, ['modulo', 'módulo']) && hasAny(sheet.headers, ['contratado', 'incluido', 'incluído']));
  let normalized = sheets[0];
  let detected = detectFileType(normalized.headers, filename);
  if (matrixSheets.length) {
    const planName = (name) => { const value = String(name).replace(/^quarkrh\s*-\s*/iu, '').trim(); const known = { premium: 'Premium', empresarial: 'Empresarial', essencial: 'Essencial', 'frequencia premium': 'Frequência Premium', 'frequencia basico': 'Frequência Básico', 'frequencia plus': 'Frequência Plus', talento: 'Talento', administrativo: 'Administrativo', organizacional: 'Organizacional', operacional: 'Operacional' }; return known[normalizeHeader(value)] ?? value; };
    const rows = matrixSheets.flatMap((sheet) => sheet.rows.filter((row) => { const contracted = valueFor(row, ['contratado', 'incluido', 'incluído']); return contracted === true || ['sim', 'true', 'yes', '1'].includes(normalizeHeader(contracted)); }).map((row) => ({ ...row, plano: planName(sheet.name), modulos_contratados: valueFor(row, ['modulo', 'módulo']) })));
    normalized = { headers: [...new Set(['plano', 'modulos_contratados', ...matrixSheets.flatMap((sheet) => sheet.headers)])], rows };
    detected = { type: FILE_TYPES.MATRIX, confidence: 'alta', reason: 'Matriz de planos identificada por abas e colunas Módulo/Contratado.' };
  }
  const validation = requiredValidation(detected.type, normalized.headers);
  const warnings = detected.reason?.includes('módulo do arquivo é ambíguo') ? [...validation.warnings, 'O módulo destes indicadores não pôde ser associado sem ambiguidade; os valores foram preservados no diagnóstico, mas não serão consolidados em um módulo.'] : validation.warnings;
  return { filename, sheet: firstSheet, sheets: sheets.map(({ rows, ...sheet }) => ({ ...sheet, rowCount: rows.length })), declaredWorksheetRows: sheets.reduce((sum, sheet) => sum + sheet.declaredRowCount, 0), type: detected.type, module: detected.module ?? null, confidence: detected.confidence, reason: detected.reason, headers: normalized.headers, rows: normalized.rows, rowCount: normalized.rows.length, competenceColumn: findAlias(normalized.headers, aliases.competence) ?? null, unitColumn: findAlias(normalized.headers, ['unidade_id', 'unit_id']) ?? null, ...validation, warnings };
}

export function relateClientNames(baseRows, usageRows) {
  const baseByKey = new Map();
  for (const row of baseRows) {
    const original = row[findAlias(Object.keys(row), aliases.clientName)] ?? null;
    const key = normalizeClientName(original);
    if (!key) continue;
    const entries = baseByKey.get(key) ?? [];
    entries.push({ original: String(original), row });
    baseByKey.set(key, entries);
  }
  const duplicateKeys = [...baseByKey.entries()].filter(([, entries]) => entries.length > 1);
  const uniqueKeys = [...baseByKey.entries()].filter(([, entries]) => entries.length === 1);
  const relatedKeys = new Set();
  const notFound = new Set();
  const ambiguous = new Set(duplicateKeys.flatMap(([, entries]) => entries.map((entry) => entry.original)));
  const records = usageRows.map((row) => {
    const original = row[findAlias(Object.keys(row), aliases.clientName)] ?? null;
    const key = normalizeClientName(original);
    const entries = key ? baseByKey.get(key) : null;
    if (!key || !entries || entries.length === 0) {
      const displayName = original === null || String(original).trim() === '' ? '(vazio)' : String(original);
      notFound.add(displayName);
      return { status: 'cliente_nao_relacionado', cliente_nome: original, cliente_nome_normalizado: key };
    }
    if (entries.length > 1) return { status: 'cliente_ambiguo', cliente_nome: original, cliente_nome_normalizado: key };
    relatedKeys.add(key);
    return { status: 'relacionado', cliente_nome: original, cliente_nome_normalizado: key };
  });
  const uniqueNames = new Map(uniqueKeys.map(([key, entries]) => [key, entries[0].original]));
  const clientsWithoutIndicators = [...uniqueNames.entries()].filter(([key]) => !relatedKeys.has(key)).map(([, name]) => name);
  return {
    records,
    diagnostics: {
      clientsInBase: baseRows.length,
      uniqueClientsByName: uniqueKeys.length,
      relatedClientsToIndicators: relatedKeys.size,
      clientsWithoutIndicators,
      indicatorNamesNotFound: [...notFound],
      ambiguousClients: [...ambiguous],
      duplicateKeys: duplicateKeys.map(([key, entries]) => ({ key, names: entries.map((entry) => entry.original) })),
    },
  };
}

export const adoptionModules = ['Departamento Pessoal', 'Benefícios', 'Folha', 'Férias', 'Frequência', 'Assinatura Eletrônica', 'T&D', 'Saúde Ocupacional', 'Gestão de EPIs', 'Avaliação de Desempenho', 'Perfil Comportamental', 'Comunicação', 'Pesquisa de Clima', 'Feedbacks', 'Administração', 'Recrutamento e Seleção', 'Portal do Colaborador', 'Portal do Gestor'];

const valueFor = (row, names) => row[findAlias(Object.keys(row), names)];
export function normalizeSignatureDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parts = XLSX.SSF.parse_date_code(value);
    return parts ? `${String(parts.y).padStart(4, '0')}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}` : null;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim().replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1').replace(/^[A-Za-z]+,\s*/u, '');
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}` : null;
}
const moduleAliases = { 'folha de pagamento': 'folha', 'treinamento e desenvolvimento': 't_d', 't&d': 't_d', 't d': 't_d', 'avaliacao e desempenho': 'avaliacao de desempenho' };
const moduleKey = (value) => { const key = normalizeHeader(value).replace(/_/g, ' '); return moduleAliases[key] ?? key; };
const parseBoolean = (value) => value === true || ['sim', 'true', 'ativo', 'active', 'yes', '1'].includes(normalizeHeader(value)) ? true : value === false || ['nao', 'false', 'inativo', 'inactive', 'no', '0'].includes(normalizeHeader(value)) ? false : null;
const parseNumber = (value) => typeof value === 'number' ? value : value !== null && value !== undefined && /^-?\d+(?:[,.]\d+)?$/.test(String(value).trim()) ? Number(String(value).trim().replace(',', '.')) : null;
function expandUsageRow(row, declaredModule, consolidationMatrix) {
  const clientName = valueFor(row, aliases.clientName);
  const module = valueFor(row, aliases.modules) ?? declaredModule;
  const indicator = valueFor(row, aliases.indicator);
  if (indicator) {
    const moduleName = module ? String(module) : null;
    const functionalId = moduleName ? mapRawIndicator(moduleName, indicator)?.functionalId ?? null : mapRawIndicatorAny(indicator)?.functionalId ?? null;
    const matrixRule = moduleName ? findConsolidationRule(consolidationMatrix, moduleName, indicator) : null;
    if (!moduleName) return [];
    return [{ row, clientName, module: moduleName, indicator: functionalId ?? String(indicator), rawIndicator: String(indicator), functionalId, value: valueFor(row, aliases.value) }];
  }
  return Object.keys(row).filter((column) => !indicatorMetadataColumns.has(normalizeHeader(column))).map((column) => {
    const mapping = declaredModule ? mapRawIndicator(declaredModule, column) : mapRawIndicatorAny(column);
    const matrixRule = declaredModule ? findConsolidationRule(consolidationMatrix, declaredModule, column) : null;
    if (!declaredModule && !mapping && !matrixRule) return null;
    return { row, clientName, module: declaredModule ?? mapping?.module ?? matrixRule?.module ?? null, indicator: mapping?.functionalId ?? column, rawIndicator: column, functionalId: mapping?.functionalId ?? null, value: row[column] };
  }).filter(Boolean);
}

function moduleList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? '').split(/[;,|\n]/u).map((item) => item.trim()).filter(Boolean);
}

function genericModuleResult(name, indicators, matrix) {
  if (!indicators.length) return { name, score: null, state: 'Sem dados de uso', status: 'sem_dados_uso', temporalType: matrix?.temporalType ?? null, configuration: null, activation: null, usage: null, indicators: [] };
  const values = Object.fromEntries(indicators.filter((item) => item.functionalId).map((item) => [item.functionalId, adoptionValue(name, item.functionalId, item.value)]));
  const result = calculateAdoptionModule(name, values);
  return { name, score: result.score, state: result.classification ?? 'Dados insuficientes', status: result.status, temporalType: result.temporalType, configuration: result.configuration.score, configurationMax: result.configuration.max, activation: result.activation.score, activationMax: result.activation.max, usage: result.usage.score, usageMax: result.usage.max, result, indicators: result.indicators.map((item) => ({ id: item.id, label: item.label, value: item.observedValue, score: item.contribution, weight: item.maxWeight, rule: item.rule, reason: item.reason, status: item.status, numerator: item.numerator, denominator: item.denominator, quantitativeProgress: item.quantitativeProgress })) };
}

function adoptionInputValue(moduleName, item) {
  return adoptionValue(moduleName, item.functionalId, item.value);
}

async function calculateFrequency(indicators, contracted) {
  const { calculateFrequencyAdoption } = await import('../../src/domain/frequency/calculate.ts');
  const byName = new Map(indicators.map((item) => [normalizeHeader(item.indicator), item.value]));
  const bool = (names) => { for (const name of names) { if (byName.has(name)) return parseBoolean(byName.get(name)); } return null; };
  const number = (names) => { for (const name of names) { if (byName.has(name)) return parseNumber(byName.get(name)); } return null; };
  const countAsBoolean = (names) => { const direct = bool(names); if (direct !== null) return direct; const count = number(names); return count === null ? null : count > 0; };
  const schedulesCount = number(['schedules', 'horarios', 'qtd_horarios']);
  const journeysCount = number(['journeys', 'jornadas', 'qtd_jornadas']);
  const pointRegistrantsCount = number(['point_registrants', 'colaboradores_registrando_ponto', 'point_registrants_count', 'registrantes_ponto']);
  const frequencyRequestsCount = number(['frequency_requests', 'solicitacoes_de_frequencia', 'qtd_solicitacoes']);
  const result = calculateFrequencyAdoption({ moduleContracted: contracted, configurationActive: countAsBoolean(['configuracao_de_frequencia_ativa', 'frequencia_ativa', 'configuration_active']), hasSchedules: schedulesCount === null ? countAsBoolean(['possui_horarios']) : schedulesCount > 0, schedulesCount, hasJourneys: journeysCount === null ? countAsBoolean(['possui_jornadas']) : journeysCount > 0, journeysCount, hasPointRegistrants: pointRegistrantsCount === null ? countAsBoolean(['existem_colaboradores_registrando_ponto']) : pointRegistrantsCount > 0, pointRegistrantsCount, eligiblePointEmployeesCount: number(['colaboradores_elegiveis', 'colaboradores_elegiveis_para_ponto', 'eligible_point_employees']), hasPointTreatment: countAsBoolean(['existe_tratamento_de_ponto', 'tratamento_de_ponto', 'point_treatment']), hasFrequencyRequests: frequencyRequestsCount === null ? countAsBoolean(['existem_solicitacoes_de_frequencia']) : frequencyRequestsCount > 0, frequencyRequestsCount });
  return { name: 'Frequência', contracted, score: result.score, state: result.classificacao ?? 'Dados insuficientes', status: result.status, configuration: result.configuracao.score, activation: result.ativacao.score, usage: result.cobertura.score, result, indicators: result.indicadores };
}

const yieldToRequestLoop = () => new Promise((resolve) => setImmediate(resolve));

export async function buildNormalizedCustomers(parsed, { onProgress = () => {} } = {}) {
  const consolidationMatrix = loadConsolidationMatrix();
  const baseRows = parsed.filter((file) => file.type === FILE_TYPES.CLIENTS).flatMap((file) => file.rows);
  const planRows = parsed.filter((file) => file.type === FILE_TYPES.PLANS).flatMap((file) => file.rows);
  const usageRows = parsed.filter(isIndicatorFile).flatMap((file) => file.rows);
  const usageRecords = parsed.filter(isIndicatorFile).flatMap((file) => file.rows.flatMap((row) => expandUsageRow(row, file.module, consolidationMatrix)));
  const sourceModules = new Set(parsed.filter(isIndicatorFile).map((file) => moduleKey(file.module)));
  const availableFunctionalIds = new Set(usageRecords.filter((record) => record.functionalId).map((record) => `${moduleKey(record.module)}:${record.functionalId}`));
  const plans = new Map(fixedPlanNames.map((name) => [normalizeHeader(name), modulesForPlan(name)]));
  const usageByClient = new Map();
  for (const record of usageRecords) {
    const { row, clientName, module, indicator, functionalId, value } = record;
    const key = normalizeClientName(clientName);
    const rawUnitId = valueFor(row, ['unidade_id', 'unit_id']);
    const entry = { cliente_nome: clientName, module, indicator, rawIndicator: record.rawIndicator ?? indicator, functionalId, value, competence: valueFor(row, aliases.competence) ?? null, unitId: rawUnitId === null || rawUnitId === undefined || String(rawUnitId).trim() === '' ? null : String(rawUnitId).trim(), unitName: valueFor(row, ['unidade_nome', 'unit_name']) ?? null };
    const list = usageByClient.get(key) ?? [];
    list.push(entry);
    usageByClient.set(key, list);
  }
  onProgress('relacionando_clientes', 0, baseRows.length);
  const relation = relateClientNames(baseRows, usageRows);
  const relationStatusByClient = new Map(relation.records.map((record) => [normalizeClientName(record.cliente_nome), record.status]));
  const customers = [];
  const consolidationDiagnostics = { byRule: {}, indicatorsWithoutRule: 0, indicatorsBlockedByPeopleDuplication: 0, indicatorsWithInsufficientData: 0, indicatorsRecalculated: 0 };
  onProgress('identificando_unidades', 0, baseRows.length);
  for (let rowIndex = 0; rowIndex < baseRows.length; rowIndex += 1) {
    const row = baseRows[rowIndex];
    if (rowIndex % 10 === 0) {
      onProgress('identificando_unidades', rowIndex, baseRows.length);
      await yieldToRequestLoop();
    }
    const name = row.task_name ?? null;
    const key = normalizeClientName(name);
    const plan = row['6_plano_drop_down'] ?? null;
    const csm = row['11_csm_responsavel_users'] ?? null;
    const normalizedPlan = normalizePlanName(plan);
    const planKey = normalizedPlan ? normalizeHeader(normalizedPlan) : '';
    const contractedModules = normalizedPlan ? modulesForPlan(normalizedPlan) : [];
    const planStatus = !plan || !String(plan).trim() ? 'plano_nao_informado' : normalizedPlan ? 'ok' : 'plano_nao_mapeado';
    const customerUsage = usageByClient.get(key) ?? [];
    const competences = [...new Set(customerUsage.map((item) => item.competence).filter(Boolean).map(String))];
    const groupByModule = (items) => { const grouped = new Map(); for (const item of items) { const list = grouped.get(moduleKey(item.module)) ?? []; list.push(item); grouped.set(moduleKey(item.module), list); } return grouped; };
    const identityFor = (item) => item.unitId ? `id:${item.unitId}` : item.unitName?.toString().trim() ? `name:${item.unitName}` : null;
    const unitIndex = new Map();
    const unassignedIndicators = [];
    for (const item of customerUsage) {
      const identity = identityFor(item);
      if (!identity) { unassignedIndicators.push(item); continue; }
      let unit = unitIndex.get(identity);
      if (!unit) {
        unit = { identity, unitId: item.unitId ?? null, unitName: item.unitName?.toString().trim() ? item.unitName : null, indicators: [] };
        unitIndex.set(identity, unit);
      }
      unit.indicators.push(item);
    }
    const unitRecords = [...unitIndex.values()];
    const scopes = [...unitRecords.map((unit) => ({ identity: unit.identity, unitId: unit.unitId, unitName: unit.unitName, indicators: unit.indicators }))];
    if (unassignedIndicators.length) scopes.push({ identity: '__unassigned__', unitId: null, unitName: 'Sem unidade identificada', indicators: unassignedIndicators });
    const moduleItemsByScope = new Map(scopes.map((scope) => [scope.identity, groupByModule(scope.indicators)]));
    const buildConsolidatedIndicators = (module, items, definition) => {
      const grouped = new Map();
      for (const item of items) {
        const raw = item.rawIndicator ?? item.indicator;
        const key = normalizeHeader(raw);
        const list = grouped.get(key) ?? [];
        list.push(item);
        grouped.set(key, list);
      }
      return [...grouped.entries()].map(([key, sources]) => {
        const rawIndicator = sources[0].rawIndicator ?? sources[0].indicator;
        const matrixRule = findConsolidationRule(consolidationMatrix, module, rawIndicator);
        const functionalId = sources.find((item) => item.functionalId)?.functionalId ?? mapRawIndicator(module, rawIndicator)?.functionalId ?? null;
        const valuesByScope = new Map();
        for (const source of sources) {
          const scopeKey = identityFor(source) ?? '__unassigned__';
          const list = valuesByScope.get(scopeKey) ?? [];
          list.push(source.value ?? null);
          valuesByScope.set(scopeKey, list);
        }
        let duplicateScope = false;
        const observations = scopes.map((scope) => {
          const values = valuesByScope.get(scope.identity) ?? [];
          const value = values.length === 1 ? values[0] : null;
          if (values.length > 1) duplicateScope = true;
          // A known unit omitted from an existing module source represents no
          // utilization for that indicator. Preserve nulls in rows that exist,
          // and preserve structural dependencies (for example DP denominators).
          const missingUnitValue = values.length === 0 && matrixRule ? 0 : value;
          return { unitId: scope.unitId, unitName: scope.unitName, value: missingUnitValue, sourceValues: values.length > 1 ? values : undefined };
        });
        const scoringRule = definition.rules.find((item) => item.id === functionalId && item.kind === 'coverage');
        const derivedMetric = findSemanticDerivedMetric(module, rawIndicator);
        let components;
        if (module === 'Frequência' && functionalId === 'point-registrants') components = scopes.map((scope) => {
          const uniqueValue = (moduleName, rawNames, requiredRule = 'SOMAR') => {
            const candidates = scope.indicators.filter((item) => rawNames.some((name) => normalizeConsolidationKey(item.rawIndicator ?? item.indicator) === normalizeConsolidationKey(name)));
            if (candidates.length !== 1 || candidates[0].value === null || candidates[0].value === undefined || candidates[0].value === '') return null;
            const value = Number(candidates[0].value);
            if (!Number.isFinite(value)) return null;
            const rule = findConsolidationRule(consolidationMatrix, moduleName, candidates[0].rawIndicator ?? candidates[0].indicator);
            return normalizeRule(rule?.rule) === requiredRule ? value : null;
          };
          const numerator = uniqueValue('Frequência', ['qtd_colaboradores_registraram_ponto'], 'RECALCULAR');
          const imported = uniqueValue('Departamento Pessoal', ['colaboradores_ativos_importacao_true']);
          const direct = uniqueValue('Departamento Pessoal', ['colaboradores_ativos_importacao_false']);
          return { numerator, denominator: imported === null || direct === null ? null : imported + direct };
        });
        else if (scoringRule || derivedMetric) components = scopes.map((scope) => {
          const findComponent = (id) => {
            const source = scope.indicators.filter((item) => {
              const rawName = item.rawIndicator ?? item.indicator;
              return (item.functionalId ?? mapRawIndicator(module, rawName)?.functionalId) === id || normalizeConsolidationKey(rawName) === normalizeConsolidationKey(id);
            });
            if (source.length !== 1) return null;
            const sourceRule = findConsolidationRule(consolidationMatrix, module, source[0].rawIndicator ?? source[0].indicator);
            return normalizeRule(sourceRule?.rule) === 'SOMAR' ? source[0].value : null;
          };
          return { numerator: findComponent(scoringRule?.numeratorId ?? derivedMetric?.numerator), denominator: findComponent(scoringRule?.denominatorId ?? derivedMetric?.denominator) };
        });
        const result = consolidateIndicator(derivedMetric?.operation ?? matrixRule?.rule, observations, { components, reason: derivedMetric?.criterion ?? matrixRule?.criterion });
        let consolidatedValue = duplicateScope ? null : result.value;
        let consolidatedStatus = duplicateScope || result.status !== 'calculado' ? 'dados_insuficientes' : 'calculado';
        let reason = duplicateScope ? 'Há mais de um valor para o mesmo indicador e unidade; consolidação segura não determinada.' : result.reason;
        if (module === 'Frequência' && functionalId === 'point-registrants' && result.status === 'calculado') reason = result.numerator > result.denominator ? 'Quantidade de colaboradores registrando ponto superior à quantidade de colaboradores ativos identificada no DP.' : 'Cobertura recalculada a partir dos registrantes e dos colaboradores ativos do DP consolidados; as coberturas das unidades não foram calculadas por média.';
        const ruleBucket = matrixRule ? normalizeRule(matrixRule.rule) : 'SEM REGRA';
        consolidationDiagnostics.byRule[ruleBucket] = (consolidationDiagnostics.byRule[ruleBucket] ?? 0) + 1;
        if (!matrixRule) consolidationDiagnostics.indicatorsWithoutRule += 1;
        if (ruleBucket === 'NÃO SOMAR AUTOMATICAMENTE') consolidationDiagnostics.indicatorsBlockedByPeopleDuplication += 1;
        if (ruleBucket === 'RECALCULAR' && result.status === 'calculado') consolidationDiagnostics.indicatorsRecalculated += 1;
        if (consolidatedStatus !== 'calculado') consolidationDiagnostics.indicatorsWithInsufficientData += 1;
        return {
          indicator: rawIndicator,
          functionalId,
          rule: matrixRule?.rule ?? null,
          criterion: matrixRule?.criterion ?? null,
          unitValues: result.evidence.map((unit, index) => ({ ...unit, sourceValues: observations[index].sourceValues, ...(module === 'Frequência' && functionalId === 'point-registrants' ? { numerator: components?.[index]?.numerator ?? null, denominator: components?.[index]?.denominator ?? null } : {}) })),
          consolidatedValue,
          status: consolidatedStatus,
          reason,
          numerator: result.numerator ?? null,
          denominator: result.denominator ?? null,
          sourceRow: matrixRule?.sourceRow ?? null,
        };
      });
    };
    const makeModules = async (items, consolidated = false) => {
      const grouped = groupByModule(items);
      const modules = [];
      for (const definition of adoptionMatrix) {
        const module = definition.name;
        const sourceIndicators = grouped.get(moduleKey(module)) ?? [];
        const moduleSourceExists = sourceModules.has(moduleKey(module));
        const contracted = normalizedPlan ? contractedModules.some((item) => moduleKey(item) === moduleKey(module)) : null;
        const contractStatus = contracted === true ? 'contratado' : contracted === false ? 'nao_incluso' : planStatus;
        const consolidationDetails = consolidated ? buildConsolidatedIndicators(module, sourceIndicators, definition) : [];
        const localDpEmployees = !consolidated && module === 'Frequência' ? (() => {
          const find = (name) => { const matches = customerUsage.filter((item) => identityFor(item) === identityFor(items[0] ?? {}) && normalizeConsolidationKey(item.rawIndicator ?? item.indicator) === normalizeConsolidationKey(name)); if (matches.length !== 1 || matches[0].value === null || matches[0].value === undefined || matches[0].value === '') return null; const value = Number(matches[0].value); const rule = findConsolidationRule(consolidationMatrix, 'Departamento Pessoal', matches[0].rawIndicator ?? matches[0].indicator); return Number.isFinite(value) && normalizeRule(rule?.rule) === 'SOMAR' ? value : null; };
          const imported = find('colaboradores_ativos_importacao_true'); const direct = find('colaboradores_ativos_importacao_false');
          return imported === null || direct === null ? null : imported + direct;
        })() : null;
        const zeroForMissingCustomer = (id) => availableFunctionalIds.has(`${moduleKey(module)}:${id}`) ? 0 : null;
        const syntheticIndicators = () => definition.rules.flatMap((rule) => rule.kind === 'coverage' ? [{ functionalId: rule.numeratorId, indicator: rule.numeratorId, value: zeroForMissingCustomer(rule.numeratorId) }, { functionalId: rule.denominatorId, indicator: rule.denominatorId, value: null }] : rule.kind === 'sum' ? [{ functionalId: rule.id, indicator: rule.id, value: zeroForMissingCustomer(rule.id) }, ...(rule.componentIds ?? []).map((id) => ({ functionalId: id, indicator: id, value: zeroForMissingCustomer(id) }))] : [{ functionalId: rule.id, indicator: rule.id, value: zeroForMissingCustomer(rule.id) }]);
        const indicators = consolidated ? consolidationDetails.filter((item) => item.functionalId).map((item) => ({ functionalId: item.functionalId, indicator: item.functionalId, rawIndicator: item.indicator, value: module === 'Frequência' && item.functionalId === 'point-registrants' ? item.numerator : adoptionValue(module, item.functionalId, item.consolidatedValue), unitValues: item.unitValues, competence: null })).concat(module === 'Frequência' && consolidationDetails.some((item) => item.functionalId === 'point-registrants') ? [{ functionalId: 'active-point-employees', indicator: 'active-point-employees', value: consolidationDetails.find((item) => item.functionalId === 'point-registrants')?.denominator ?? null }] : []) : sourceIndicators.length ? sourceIndicators.map((item) => ({ ...item, value: module === 'Frequência' && item.functionalId === 'point-registrants' ? parseNumber(item.value) : item.value })).concat(module === 'Frequência' && sourceIndicators.some((item) => item.functionalId === 'point-registrants') ? [{ functionalId: 'active-point-employees', indicator: 'active-point-employees', value: localDpEmployees }] : []) : moduleSourceExists && contracted !== false ? syntheticIndicators() : [];
        if (consolidated && sourceIndicators.length === 0 && moduleSourceExists && contracted !== false) indicators.push(...syntheticIndicators());
        let usage = contracted === false ? { ...calculateAdoptionModule(module, {}, false), name: module } : sourceIndicators.length === 0 && !moduleSourceExists ? { name: module, score: null, state: 'Dados insuficientes', status: 'dados_insuficientes', configuration: null, activation: null, usage: null, usageReason: 'Fonte/arquivo de utilização do módulo não disponível no lote.' } : competences.length > 1 ? { name: module, score: null, state: 'Dados insuficientes', status: 'dados_insuficientes', configuration: null, activation: null, usage: null, usageReason: 'Selecione uma competência para calcular o score.', indicators: indicators.map((item) => ({ id: item.functionalId ?? item.indicator, label: item.rawIndicator ?? item.indicator, value: item.value, score: null, status: item.value === null || item.value === undefined ? 'ausente' : 'disponivel', competence: item.competence })) } : consolidated && indicators.length === 0 ? { name: module, score: null, state: 'Dados insuficientes', status: 'dados_insuficientes', configuration: null, activation: null, usage: null, usageReason: 'Há indicadores observados, mas nenhum está mapeado para as entradas do motor de adoção.', indicators: [] } : genericModuleResult(module, consolidated ? indicators.map((item) => ({ ...item, value: adoptionInputValue(module, item) })) : indicators, definition);
        if (consolidated && sourceIndicators.length) {
          const detailsByFunctionalId = new Map(consolidationDetails.filter((item) => item.functionalId).map((item) => [item.functionalId, item]));
          usage.indicators = (usage.indicators ?? []).map((item) => {
            const detail = detailsByFunctionalId.get(item.id);
            if (detail) return { ...item, status: detail.status === 'dados_insuficientes' ? 'dados_insuficientes' : item.status, reason: detail.reason, rule: detail.rule, numerator: detail.numerator, denominator: detail.denominator };
            return item;
          });
        } else if (module === 'Frequência' && sourceIndicators.length) {
          const localPointRegistrants = sourceIndicators.find((item) => item.functionalId === 'point-registrants');
          usage.indicators = (usage.indicators ?? []).map((item) => item.id === 'point-registrants' ? { ...item, rawValue: localPointRegistrants?.value ?? null, numerator: parseNumber(localPointRegistrants?.value), denominator: localDpEmployees, rule: 'cobertura = registrantes / colaboradores ativos DP × 30', reason: localDpEmployees === null ? 'Componentes ativos do Departamento Pessoal ausentes, duplicados ou inválidos.' : item.reason } : item);
        }
      modules.push({ ...usage, classification: usage.classification ?? classifyAdoption(usage.score), contractStatus, contracted: contracted === true, hasUsageIndicators: sourceIndicators.length > 0, consolidationDetails, state: usage.status === 'calculado' ? usage.state : usage.status === 'sem_dados_uso' ? 'Sem dados de uso' : 'Dados insuficientes' });
      }
      return modules;
    };
    onProgress('consolidando_indicadores', rowIndex, baseRows.length);
    const modules = await makeModules(customerUsage, true);
    const units = [];
    for (const unit of unitRecords) {
      const unitModules = await makeModules(unit.indicators);
      const unitEvaluated = unitModules.filter((module) => module.contractStatus === 'contratado' && module.score !== null);
      const unitInsufficient = unitModules.filter((module) => module.contractStatus === 'contratado' && module.status === 'dados_insuficientes');
      const unitContractedCount = unitModules.filter((module) => module.contractStatus === 'contratado').length;
      units.push({ unitId: unit.unitId, unitName: unit.unitName, displayName: unit.unitName ?? `Unidade ${unit.unitId}`, modules: unitModules, overallScore: unitEvaluated.length ? unitEvaluated.reduce((sum, module) => sum + module.score, 0) / unitEvaluated.length : null, overallScoreReason: unitEvaluated.length ? null : unitContractedCount ? 'Nenhum módulo contratado possui score calculável.' : 'Não há módulos com contratação confirmada.', evaluatedModules: unitEvaluated.length, insufficientModules: unitInsufficient.length });
    }
    const evaluated = modules.filter((module) => module.contractStatus === 'contratado' && module.score !== null);
    const insufficient = modules.filter((module) => module.contractStatus === 'contratado' && module.status === 'dados_insuficientes');
    const contractedCount = modules.filter((module) => module.contractStatus === 'contratado').length;
    const modulesWithIndicators = modules.filter((module) => module.hasUsageIndicators).length;
    const overallScore = evaluated.length ? evaluated.reduce((sum, module) => sum + module.score, 0) / evaluated.length : null;
    const sourceText = row.clickup_sources ?? null;
    customers.push({ cliente_nome: name ?? null, csm_responsavel: csm ?? null, plano: plan ?? null, clienteNome: name ?? null, plan: plan ?? null, planStatus, journey: valueFor(row, aliases.journey) ?? null, csm: csm ?? null, mrr: valueFor(row, aliases.mrr) ?? null, signedAt: normalizeSignatureDate(valueFor(row, aliases.signedAt)), category: valueFor(row, aliases.category) ?? null, goLiveAt: valueFor(row, aliases.goLiveAt) ?? null, active: typeof row.clickup_active === 'boolean' ? row.clickup_active : true, sources: sourceText ? String(sourceText).split('|').filter(Boolean) : ['PLANILHA'], sourceConflicts: parseClientSourceConflicts(row.clickup_conflicts), competence: competences.length === 1 ? competences[0] : competences.length > 1 ? 'múltiplas competências — seleção necessária' : null, unitIds: [...new Set(customerUsage.map((item) => item.unitId).filter(Boolean))], unitCount: units.length, units, unassignedIndicators, contractedModules: modules.filter((module) => module.contractStatus === 'contratado').map((module) => module.name), modules, overallScore, overallClassification: classifyAdoption(overallScore), overallScoreReason: evaluated.length ? null : contractedCount ? 'Nenhum módulo contratado possui score calculável.' : 'Não há módulos com contratação confirmada.', evaluatedModules: evaluated.length, insufficientModules: insufficient.length, modulesWithIndicators, modulesWithoutIndicators: modules.length - modulesWithIndicators, nonIncludedModules: modules.filter((module) => module.contractStatus === 'nao_incluso').length, relationStatus: relationStatusByClient.get(key) ?? 'cliente_nao_relacionado' });
    onProgress('calculando_adocao', rowIndex + 1, baseRows.length);
  }
  const mapping = [...new Set(usageRecords.map((record) => record.module).filter(Boolean))].map((moduleName) => mappingForModule(moduleName, usageRecords.filter((record) => record.module === moduleName).map((record) => record.indicator)));
  const clientPlans = baseRows.map((row) => row['6_plano_drop_down'] ?? null);
  const clientCsms = baseRows.map((row) => row['11_csm_responsavel_users'] ?? null);
  const allUnits = customers.flatMap((customer) => customer.units);
  const customerUnitCounts = customers.map((customer) => customer.unitCount);
  return { customers, plans: fixedPlanNames.map((planName) => ({ planName, contractedModules: modulesForPlan(planName) })), diagnostics: { ...relation.diagnostics, clientCount: baseRows.length, identifiedUnits: allUnits.length, clientsWithOneUnit: customerUnitCounts.filter((count) => count === 1).length, clientsWithMultipleUnits: customerUnitCounts.filter((count) => count > 1).length, recordsWithoutUnit: usageRows.filter((row) => !String(valueFor(row, ['unidade_id', 'unit_id']) ?? '').trim() && !String(valueFor(row, ['unidade_nome', 'unit_name']) ?? '').trim()).length, maxUnitsPerClient: customerUnitCounts.length ? Math.max(...customerUnitCounts) : 0, consolidationMatrix: consolidationMatrix.diagnostics, consolidation: consolidationDiagnostics, clientsWithCsm: clientCsms.filter((value) => value !== null && String(value).trim() !== '').length, clientsWithoutCsm: clientCsms.filter((value) => value === null || String(value).trim() === '').length, clientsWithPlan: clientPlans.filter((value) => value !== null && String(value).trim() !== '').length, clientsWithoutPlan: clientPlans.filter((value) => value === null || String(value).trim() === '').length, recognizedPlans: [...new Set(clientPlans.map(normalizePlanName).filter(Boolean))], plansFound: fixedPlanNames.length, plansNotMapped: [...new Set(clientPlans.filter((plan) => plan && !normalizePlanName(plan)))], modulesIdentified: [...new Set(fixedPlanNames.flatMap((plan) => modulesForPlan(plan)))], indicatorFilesProcessed: parsed.filter(isIndicatorFile).length, indicatorsRecognized: usageRecords.filter((record) => record.functionalId).length, indicatorsNotRecognized: usageRecords.filter((record) => !record.functionalId).length, mapping, indicatorsMapped: mapping.reduce((sum, item) => sum + item.confirmed.length, 0), indicatorsAbsent: mapping.reduce((sum, item) => sum + item.absent.length, 0), indicatorsPendingDecision: mapping.reduce((sum, item) => sum + item.unmapped.length, 0), unmappedColumns: [...new Set(mapping.flatMap((item) => item.unmapped))], competencies: [...new Set(usageRecords.map((record) => valueFor(record.row, aliases.competence)).filter(Boolean).map(String))], mixedCompetencies: new Set(usageRecords.map((record) => valueFor(record.row, aliases.competence)).filter(Boolean).map(String)).size > 1, availableIndicatorNames: [...new Set(usageRecords.map((record) => record.indicator))] } };
}

export async function inspectFiles(files) {
  const parsed = [];
  for (const file of files) {
    try { parsed.push(parseWorkbook(file.content, file.filename)); }
    catch (error) { parsed.push({ filename: file.filename, sheet: null, sheets: [], declaredWorksheetRows: 0, type: FILE_TYPES.UNKNOWN, module: null, confidence: 'baixa', reason: 'Arquivo não processado.', headers: [], rows: [], rowCount: 0, errors: [], warnings: [`Arquivo não processado: ${error instanceof Error ? error.message : 'arquivo vazio ou corrompido.'}`], parseError: error instanceof Error ? error.message : 'arquivo vazio ou corrompido.' }); }
  }
  const baseFiles = parsed.filter((file) => file.type === FILE_TYPES.CLIENTS);
  const indicatorFiles = parsed.filter(isIndicatorFile);
  const errors = parsed.flatMap((file) => file.errors.map((message) => `${file.filename}: ${message}`));
  const warnings = parsed.flatMap((file) => file.warnings.map((message) => `${file.filename}: ${message}`));
  if (baseFiles.length === 0) errors.push('Selecione uma Base de Clientes reconhecida.');
  if (baseFiles.length > 1) errors.push('Selecione somente uma Base de Clientes por importação.');
  if (indicatorFiles.length === 0) errors.push('Selecione ao menos um arquivo de indicadores de uso.');
  const recognized = parsed.filter((file) => file.type !== FILE_TYPES.UNKNOWN);
  const modules = [...new Set(indicatorFiles.map((file) => file.module).filter(Boolean))];
  const totalRows = parsed.reduce((sum, file) => sum + file.rowCount, 0);
  const resultFiles = parsed.map(({ rows, ...file }) => ({ ...file, preview: rows.slice(0, 5) }));
  return {
    files: resultFiles,
    diagnostics: {
      filesReceived: parsed.length,
      filesRecognized: recognized.length,
      filesIgnored: parsed.filter((file) => file.type === FILE_TYPES.UNKNOWN).map((file) => ({ filename: file.filename, reason: file.parseError ?? file.reason })),
      clientCount: baseFiles.reduce((sum, file) => sum + file.rowCount, 0),
      indicatorFilesProcessed: indicatorFiles.length,
      modulesFound: modules.length,
      modulesTotal: 18,
      modules,
    },
    summary: { totalFiles: parsed.length, recognizedFiles: recognized.length, unknownFiles: parsed.length - recognized.length, totalRows, usefulRows: totalRows },
    errors,
    warnings,
    canProcess: errors.length === 0 && recognized.length > 0,
  };
}

export async function processFiles(files, { onProgress = () => {} } = {}) {
  const startedAt = Date.now();
  const parsingStartedAt = Date.now();
  const parsed = [];
  onProgress('lendo_arquivos', 0, files.length);
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    try { parsed.push(parseWorkbook(file.content, file.filename)); }
    catch (error) { parsed.push({ filename: file.filename, sheet: null, sheets: [], declaredWorksheetRows: 0, type: FILE_TYPES.UNKNOWN, module: null, confidence: 'baixa', reason: 'Arquivo não processado.', headers: [], rows: [], rowCount: 0, competenceColumn: null, unitColumn: null, errors: [], warnings: [`Arquivo não processado: ${error instanceof Error ? error.message : 'arquivo vazio ou corrompido.'}`], parseError: error instanceof Error ? error.message : 'arquivo vazio ou corrompido.' }); }
    onProgress('lendo_arquivos', index + 1, files.length);
    await yieldToRequestLoop();
  }
  const parsingMs = Date.now() - parsingStartedAt;
  const errors = parsed.flatMap((file) => file.errors.map((message) => `${file.filename}: ${message}`));
  const warnings = parsed.flatMap((file) => file.warnings.map((message) => `${file.filename}: ${message}`));
  const recognized = parsed.filter((file) => file.type !== FILE_TYPES.UNKNOWN);
  const baseRows = parsed.filter((file) => file.type === FILE_TYPES.CLIENTS).flatMap((file) => file.rows);
  const usageRows = parsed.filter(isIndicatorFile).flatMap((file) => file.rows);
  const normalizationStartedAt = Date.now();
  onProgress('validando_estrutura', files.length, files.length);
  const normalized = await buildNormalizedCustomers(parsed, { onProgress });
  const normalizationMs = Date.now() - normalizationStartedAt;
  const relationStartedAt = Date.now();
  const relation = baseRows.length > 0 && usageRows.length > 0 ? relateClientNames(baseRows, usageRows) : { records: [], diagnostics: { clientsInBase: baseRows.length, uniqueClientsByName: 0, relatedClientsToIndicators: 0, clientsWithoutIndicators: [], indicatorNamesNotFound: [], ambiguousClients: [] } };
  const relationMs = Date.now() - relationStartedAt;
  const joinable = recognized.every((file) => !isIndicatorFile(file) || hasAny(file.headers, aliases.clientName));
  const diagnostics = { ...relation.diagnostics, ...normalized.diagnostics, filesReceived: parsed.length, filesRecognized: recognized.length, filesIgnored: parsed.filter((file) => file.type === FILE_TYPES.UNKNOWN).map((file) => ({ filename: file.filename, reason: file.parseError ?? file.reason })), modulesFound: [...new Set(normalized.diagnostics.mapping.map((item) => moduleKey(item.module)))].length, modulesTotal: 18, customersWithOverallScore: normalized.customers.filter((customer) => customer.overallScore !== null).length, modulesWithScore: Object.fromEntries(adoptionModules.map((module) => [module, normalized.customers.filter((customer) => customer.modules.find((item) => moduleKey(item.name) === moduleKey(module))?.score !== null).length])) };
  const matrixDiagnostics = loadConsolidationMatrix().diagnostics;
  return { files: parsed.map(({ rows, ...file }) => ({ ...file, preview: rows.slice(0, 5) })), diagnostics, relationRecords: relation.records, customers: normalized.customers, plans: normalized.plans, summary: { totalFiles: parsed.length, recognizedFiles: recognized.length, unknownFiles: parsed.length - recognized.length, totalRows: parsed.reduce((sum, file) => sum + file.rowCount, 0), usefulRows: parsed.reduce((sum, file) => sum + file.rowCount, 0), parsingMs, normalizationMs, relationMs, consolidationMs: normalizationMs, adoptionCalculationMs: normalizationMs, processingMs: Date.now() - startedAt, joinStatus: joinable ? 'cliente_nome_exato' : 'nao_processado', matrixStatus: matrixDiagnostics?.rows ? 'carregada_do_projeto' : 'nao_recebida' }, errors, warnings, canProcess: parsed.length > 0 && errors.length === 0 && recognized.length > 0 };
}
