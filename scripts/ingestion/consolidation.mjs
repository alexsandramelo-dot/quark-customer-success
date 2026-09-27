import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const matrixPath = resolve(fileURLToPath(new URL('../../matriz_consolidacao_modulos_quarkrh.xlsx', import.meta.url)));
const semanticOverrides = JSON.parse(readFileSync(fileURLToPath(new URL('./semantic-overrides.json', import.meta.url)), 'utf8'));
const fold = (value) => String(value ?? '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const foldModule = (module) => ({ treinamento_e_desenvolvimento: 't_d', folha_de_pagamento: 'folha', epi: 'gestao_de_epis' })[fold(module)] ?? fold(module);
let cachedDefaultMatrix;

export function loadConsolidationMatrix(path = matrixPath) {
  if (path === matrixPath && cachedDefaultMatrix) return cachedDefaultMatrix;
  const workbook = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets['Matriz de Consolidação'];
  if (!sheet) throw new Error('A aba "Matriz de Consolidação" não existe na matriz funcional.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  const headerRow = rows.findIndex((row) => row.some((cell) => fold(cell) === 'modulo') && row.some((cell) => fold(cell) === 'indicador'));
  if (headerRow < 0) throw new Error('Cabeçalhos Módulo e Indicador não encontrados na matriz funcional.');
  const headers = rows[headerRow].map(fold);
  const columns = {
    module: headers.indexOf('modulo'),
    indicator: headers.indexOf('indicador'),
    rule: headers.indexOf('regra_de_consolidacao'),
    criterion: headers.indexOf('criterio_observacao') >= 0 ? headers.indexOf('criterio_observacao') : headers.indexOf('formula_criterio'),
  };
  if (Object.values(columns).some((index) => index < 0)) throw new Error('A matriz precisa conter Módulo, Indicador, Regra de consolidação e Critério / observação.');
  const rules = rows.slice(headerRow + 1).map((row, index) => ({ module: String(row[columns.module] ?? '').trim(), indicator: String(row[columns.indicator] ?? '').trim(), rule: String(row[columns.rule] ?? '').trim(), criterion: String(row[columns.criterion] ?? '').trim(), sourceRow: headerRow + index + 2 })).filter((item) => item.module || item.indicator || item.rule || item.criterion);
  if (path === matrixPath) for (const override of semanticOverrides.overrides) {
    const existing = rules.find((item) => foldModule(item.module) === foldModule(override.module) && fold(item.indicator) === fold(override.indicator));
    if (!existing) throw new Error(`Correção semântica sem linha de origem na matriz: ${override.module} / ${override.indicator}.`);
    existing.sourceRule = existing.rule;
    existing.sourceCriterion = existing.criterion;
    existing.rule = override.rule;
    existing.criterion = override.criterion;
  }
  const invalid = rules.filter((item) => !item.module || !item.indicator || !item.rule);
  if (invalid.length) throw new Error(`A matriz contém ${invalid.length} linha(s) sem módulo, indicador ou regra.`);
  const byKey = new Map();
  const duplicates = [];
  for (const item of rules) {
    const key = `${foldModule(item.module)}|${fold(item.indicator)}`;
    if (byKey.has(key)) duplicates.push(item);
    else byKey.set(key, item);
  }
  if (duplicates.length) throw new Error(`A matriz contém ${duplicates.length} combinação(ões) duplicada(s) de módulo e indicador.`);
  const counts = {};
  for (const item of rules) {
    const key = normalizeRule(item.rule);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const loaded = { rules, byKey, diagnostics: { source: path, rows: rules.length, modules: [...new Set(rules.map((item) => item.module))].length, counts } };
  if (path === matrixPath) cachedDefaultMatrix = loaded;
  return loaded;
}

export const normalizeConsolidationKey = fold;
export const findConsolidationRule = (matrix, module, indicator) => matrix.byKey.get(`${foldModule(module)}|${fold(indicator)}`) ?? null;
export const findSemanticDerivedMetric = (module, indicator) => semanticOverrides.derivedMetrics.find((item) => foldModule(item.module) === foldModule(module) && fold(item.indicator) === fold(indicator)) ?? null;
export const consolidationModuleKey = foldModule;
export function normalizeRule(rule) {
  const value = String(rule ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  if (value.startsWith('ANY')) return 'ANY';
  if (value === 'MIN' || value.includes('DATA MAIS ANTIGA') || value.includes('DATA PRIMEIRA') || value.includes('DATA MAIS VELHA')) return 'MIN';
  if (value === 'MAX' || value === 'MAXIMO' || value.includes('DATA MAIS RECENTE')) return 'MAX';
  if (value === 'NAO CONSOLIDAR' || value === 'NÃO CONSOLIDAR') return 'NÃO CONSOLIDAR';
  if (value === 'MEDIA PONDERADA' || value === 'MÉDIA PONDERADA') return 'MÉDIA PONDERADA';
  if (value === 'SOMAR') return 'SOMAR';
  if (value === 'RECALCULAR') return 'RECALCULAR';
  if (value.includes('MAXIMO') && value.includes('DATA MAIS RECENTE')) return 'MAX';
  if (value === 'NAO SOMAR AUTOMATICAMENTE') return 'NÃO SOMAR AUTOMATICAMENTE';
  if (value === 'REVISAR REGRA') return 'REVISAR REGRA';
  return 'INCONCLUSIVA';
}

const status = (value, reason = null) => ({ value, status: value === null ? 'dados_insuficientes' : 'calculado', reason });
const toBoolean = (value) => {
  if (value === true || value === false) return value;
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (['true', 'sim', 'yes', 'ativo', 'active', '1'].includes(normalized)) return true;
  if (['false', 'nao', 'no', 'inativo', 'inactive', '0'].includes(normalized)) return false;
  if (/^\d+(?:[,.]\d+)?$/.test(normalized)) return Number(normalized.replace(',', '.')) > 0;
  return null;
};
const dateTime = (value) => {
  if (typeof value === 'number' && value >= 20000 && value <= 80000) {
    const date = XLSX.SSF.parse_date_code(value);
    return date ? Date.UTC(date.y, date.m - 1, date.d, date.H, date.M, Math.floor(date.S)) : NaN;
  }
  const text = String(value ?? '').trim();
  const localDate = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
  if (localDate) return Date.UTC(Number(localDate[3]), Number(localDate[2]) - 1, Number(localDate[1]));
  return Date.parse(text);
};

export function consolidateIndicator(rule, observations, options = {}) {
  const evidence = observations.map((item) => ({ unitId: item.unitId ?? null, unitName: item.unitName ?? null, value: item.value ?? null }));
  const operation = normalizeRule(rule);
  const finish = (result, reason = null, extra = {}) => ({ ...status(result, reason), rule: rule ?? 'SEM REGRA', evidence, ...extra });

  if (operation === 'SOMAR') {
    const values = observations.map((item) => item.value);
    if (!values.length || values.some((value) => value === null || value === undefined || value === '')) {
      const known = values.filter((value) => value !== null && value !== undefined && value !== '').map(Number).filter(Number.isFinite);
      return finish(null, 'Há unidades sem valor conhecido; ausência não foi tratada como zero.', { knownSubtotal: known.length ? known.reduce((sum, value) => sum + value, 0) : null });
    }
    const numeric = values.map(Number);
    if (numeric.some((value) => !Number.isFinite(value))) return finish(null, 'Um ou mais valores não são numéricos.');
    return finish(numeric.reduce((sum, value) => sum + value, 0));
  }

  if (operation.startsWith('ANY')) {
    const values = observations.map((item) => toBoolean(item.value));
    if (values.some((value) => value === true)) return finish(true);
    if (values.every((value) => value === false) && values.length > 0) return finish(false);
    if (values.some((value) => value === null) && values.some((value) => value !== null)) return finish(null, 'Há unidades sem valor booleano conhecido.');
    return finish(null, 'Todos os valores estão ausentes ou não são booleanos válidos.');
  }

  if (operation === 'RECALCULAR') {
    const numerators = options.components?.map((item) => item.numerator);
    const denominators = options.components?.map((item) => item.denominator);
    if (!numerators?.length || numerators.some((value) => value === null || value === undefined || value === '') || denominators.some((value) => value === null || value === undefined || value === '')) {
      const detail = 'Numeradores e denominadores completos não estão disponíveis para recalcular.';
      return finish(null, options.reason ? `${options.reason} ${detail}` : detail, { numerator: null, denominator: null });
    }
    const numerator = numerators.reduce((sum, value) => sum + Number(value), 0);
    const denominator = denominators.reduce((sum, value) => sum + Number(value), 0);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return finish(null, 'Numerador/denominador inválido.', { numerator: null, denominator: null });
    if (denominator <= 0) return finish(null, 'Numerador/denominador inválido ou denominador igual a zero.', { numerator, denominator });
    return finish((numerator / denominator) * 100, null, { numerator, denominator });
  }

  if (operation === 'MIN' || operation === 'MAX') {
    const supplied = observations.filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
    const dates = supplied.map((item) => ({ value: item.value, time: dateTime(item.value) }));
    if (dates.some((item) => !Number.isFinite(item.time))) return finish(null, 'Uma ou mais datas informadas são inválidas.');
    if (!dates.length) return finish(null, 'Nenhuma data válida disponível.');
    return finish(dates.reduce((selected, item) => operation === 'MAX' ? item.time > selected.time ? item : selected : item.time < selected.time ? item : selected).value);
  }

  if (operation === 'MÉDIA PONDERADA') {
    const rawNumerators = options.components?.map((item) => item.numerator);
    const rawDenominators = options.components?.map((item) => item.denominator);
    if (!rawNumerators?.length || rawNumerators.some((value) => value === null || value === undefined || value === '') || rawDenominators?.some((value) => value === null || value === undefined || value === '')) return finish(null, 'Valores e pesos da média ponderada não estão completos.', { numerator: null, denominator: null });
    const numerators = rawNumerators.map(Number);
    const denominators = rawDenominators.map(Number);
    if (numerators.some((value) => !Number.isFinite(value)) || denominators.some((value) => !Number.isFinite(value))) return finish(null, 'Valores e pesos da média ponderada não estão completos.', { numerator: null, denominator: null });
    const numerator = numerators.reduce((sum, value) => sum + value, 0);
    const denominator = denominators.reduce((sum, value) => sum + value, 0);
    if (denominator <= 0) return finish(null, 'Peso total indisponível ou igual a zero.', { numerator: null, denominator });
    return finish(numerator / denominator, null, { numerator, denominator });
  }

  if (operation === 'NÃO SOMAR AUTOMATICAMENTE') return finish(null, 'Não é possível consolidar a quantidade entre unidades sem identificadores individuais que permitam eliminar duplicidades.');
  if (operation === 'NÃO CONSOLIDAR') return finish(null, options.reason ?? 'A estatística resumida não pode ser reconstruída corretamente entre unidades sem observações individuais.');
  if (operation === 'REVISAR REGRA') return finish(null, 'Regra de consolidação entre unidades ainda não definida para este indicador.');
  if (operation === 'SOMAR OU RECALCULAR') return finish(null, options.reason ?? 'A matriz indica SOMAR OU RECALCULAR, mas a origem não informa se o indicador é um volume ou uma média ponderada.');
  return finish(null, 'Indicador sem regra de consolidação definida na matriz.');
}
