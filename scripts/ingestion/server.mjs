import { mkdir, open as openFile, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { once } from 'node:events';
import { FILE_TYPES, inspectFiles, parseWorkbook, processFiles } from './core.mjs';
import { adoptionMatrix } from '../../src/domain/adoption/matrix.ts';
import { classifyAdoption } from '../../src/domain/adoption/classification.ts';
import { moduleAvailabilityReason } from '../../src/domain/dashboard/moduleAvailability.ts';
import { clickUpRosterCsv, fetchClickUpRoster } from './clickup.mjs';

const MAX_BODY = 20 * 1024 * 1024;
const MAX_FILE = 10 * 1024 * 1024;
const statePath = join(process.cwd(), '.local-data', 'processed-state.json');
const rawFilesPath = join(process.cwd(), '.local-data', 'raw-files.json.gz');
let cachedState = null;
let cachedStateMtime = -1;
let processingProgress = { status: 'idle', stage: 'idle', completed: 0, total: 0, updatedAt: null };

const progressStage = (stage, completed = 0, total = 0) => {
  processingProgress = { status: 'processando', stage, completed, total, updatedAt: new Date().toISOString() };
};

async function writeJsonValue(response, value) {
  if (value === null || typeof value !== 'object') {
    if (!response.write(JSON.stringify(value) ?? 'null')) await once(response, 'drain');
    return;
  }
  if (Array.isArray(value)) {
    if (!response.write('[')) await once(response, 'drain');
    for (let index = 0; index < value.length; index += 1) {
      if (index && !response.write(',')) await once(response, 'drain');
      const serialized = JSON.stringify(value[index]) ?? 'null';
      if (!response.write(serialized)) await once(response, 'drain');
    }
    if (!response.write(']')) await once(response, 'drain');
    return;
  }
  if (!response.write('{')) await once(response, 'drain');
  let first = true;
  for (const [key, item] of Object.entries(value)) {
    if (!first && !response.write(',')) await once(response, 'drain');
    first = false;
    if (!response.write(`${JSON.stringify(key)}:`)) await once(response, 'drain');
    await writeJsonValue(response, item);
  }
  if (!response.write('}')) await once(response, 'drain');
}

async function writeJsonFile(handle, value) {
  const write = async (chunk) => { const buffer = Buffer.from(chunk, 'utf8'); let offset = 0; while (offset < buffer.length) { const result = await handle.write(buffer, offset, buffer.length - offset, null); offset += result.bytesWritten; } };
  if (value === null || typeof value !== 'object') { await write(JSON.stringify(value) ?? 'null'); return; }
  if (Array.isArray(value)) {
    await write('[');
    // Serialize each array entry as a single chunk. The state contains many
    // deeply nested objects; writing every scalar separately made persistence
    // take minutes while retaining the entire processed snapshot in memory.
    for (let index = 0; index < value.length; index += 1) {
      if (index) await write(',');
      const serialized = JSON.stringify(value[index]) ?? 'null';
      await write(serialized);
    }
    await write(']'); return;
  }
  await write('{');
  let first = true;
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol') continue;
    if (!first) await write(','); first = false;
    await write(JSON.stringify(key) + ':'); await writeJsonFile(handle, item);
  }
  await write('}');
}

async function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  await writeJsonValue(response, body);
  response.end();
}

async function bodyBuffer(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('O lote excede o limite local de 20 MB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '');
  if (!match) throw new Error('Requisição de upload sem boundary multipart.');
  const boundary = Buffer.from(`--${match[1] ?? match[2]}`);
  const files = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const start = buffer.indexOf(boundary, cursor);
    if (start < 0) break;
    const headerStart = start + boundary.length + 2;
    const next = buffer.indexOf(boundary, headerStart);
    if (next < 0) break;
    const part = buffer.subarray(headerStart, next - 2);
    const split = part.indexOf(Buffer.from('\r\n\r\n'));
    if (split >= 0) {
      const headers = part.subarray(0, split).toString('utf8');
      const content = part.subarray(split + 4);
      const name = /filename="([^"]+)"/i.exec(headers)?.[1];
      if (name) {
        if (content.length > MAX_FILE) throw new Error(`O arquivo ${name} excede o limite local de 10 MB.`);
        files.push({ filename: name, content });
      }
    }
    cursor = next;
  }
  if (!files.length) throw new Error('Nenhum arquivo foi enviado.');
  return files;
}

async function loadState({ withRawFiles = false } = {}) {
  try {
    const info = await stat(statePath);
    if (!cachedState || cachedStateMtime !== info.mtimeMs) {
      cachedState = JSON.parse(await readFile(statePath, 'utf8'));
      cachedStateMtime = info.mtimeMs;
    }
    const state = { ...cachedState };
    if (withRawFiles) {
      try {
        const archiveName = basename(state.rawFilesArchive ?? 'raw-files.json.gz');
        state.rawFiles = JSON.parse(gunzipSync(await readFile(join(join(process.cwd(), '.local-data'), archiveName)), { maxOutputLength: 1024 * 1024 * 1024 }).toString('utf8'));
      } catch { state.rawFiles ??= []; /* migração compatível: lotes anteriores guardam os arquivos no estado */ }
    }
    return state;
  } catch { return { status: 'nenhum_lote_processado', files: [], summary: null }; }
}

async function persistState(state, rawFiles = state.rawFiles) {
  const { rawFiles: _rawFiles, ...previousState } = state;
  await mkdir(join(process.cwd(), '.local-data'), { recursive: true });
  const previousArchive = previousState.rawFilesArchive;
  const archiveName = rawFiles?.length ? `raw-files-${Date.now()}-${randomUUID()}.json.gz` : previousArchive;
  const compactState = { ...previousState, ...(archiveName ? { rawFilesArchive: archiveName } : {}) };
  if (rawFiles?.length) {
    const archiveTemp = join(process.cwd(), '.local-data', `${archiveName}.tmp`);
    await writeFile(archiveTemp, gzipSync(Buffer.from(JSON.stringify(rawFiles), 'utf8')));
    await rename(archiveTemp, join(process.cwd(), '.local-data', archiveName));
  }
  const stateTemp = `${statePath}.${randomUUID()}.tmp`;
  const handle = await openFile(stateTemp, 'w');
  try { await writeJsonFile(handle, compactState); await handle.sync(); } finally { await handle.close(); }
  await rename(stateTemp, statePath);
  cachedState = compactState;
  cachedStateMtime = (await stat(statePath)).mtimeMs;
  if (previousArchive && previousArchive !== archiveName) await unlink(join(process.cwd(), '.local-data', basename(previousArchive))).catch(() => {});
  if (previousArchive === undefined) await unlink(rawFilesPath).catch(() => {});
  return compactState;
}

const publicState = (state) => { const { rawFiles, rawFilesArchive, ...safe } = state; return safe; };
const statusView = (state) => ({ status: state.status, processedAt: state.processedAt, files: state.files, summary: state.summary, diagnostics: state.diagnostics, warnings: state.warnings, errors: state.errors, clickupSync: state.clickupSync ?? null });
const normalizeModuleName = (value) => {
  const key = String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return ({ 'folha de pagamento': 'folha', 'treinamento e desenvolvimento': 't d', 'gestao de epis': 'epi', 'avaliacao e desempenho': 'avaliacao de desempenho' })[key] ?? key;
};
const summaryCustomer = (customer) => ({ clienteNome: customer.clienteNome, plan: customer.plan, planStatus: customer.planStatus, csm: customer.csm, journey: customer.journey, mrr: customer.mrr ?? null, signedAt: customer.signedAt ?? null, category: customer.category ?? null, active: customer.active !== false, sources: customer.sources ?? ['PLANILHA'], sourceConflicts: customer.sourceConflicts ?? [], contractedModules: customer.contractedModules, unitCount: customer.unitCount, overallScore: customer.overallScore, overallClassification: classifyAdoption(customer.overallScore), overallScoreReason: customer.overallScoreReason, evaluatedModules: customer.evaluatedModules, insufficientModules: customer.insufficientModules, modulesWithIndicators: customer.modulesWithIndicators, modulesWithoutIndicators: customer.modulesWithoutIndicators, nonIncludedModules: customer.nonIncludedModules, moduleMetrics: (customer.modules ?? []).map(({ name, contractStatus, score, status }) => ({ name, contractStatus, score, status })) });
const moduleRules = (module) => adoptionMatrix.find((item) => sameModule(item.name, module.name))?.rules ?? [];
const summaryModule = (module) => { const { consolidationDetails: _details, result: _result, ...summary } = module; return { ...summary, classification: classifyAdoption(module.score), state: classifyAdoption(module.score) ?? module.state, usageReason: moduleAvailabilityReason(module) ?? module.usageReason ?? null }; };
const customerDetail = (customer) => ({ ...customer, overallClassification: classifyAdoption(customer.overallScore), unassignedIndicatorCount: customer.unassignedIndicators?.length ?? 0, unassignedIndicators: undefined, indicatorsByModule: undefined, consolidatedModules: undefined, modules: (customer.modules ?? []).map(summaryModule), units: (customer.units ?? []).map((unit) => ({ ...unit, overallClassification: classifyAdoption(unit.overallScore), modules: (unit.modules ?? []).map(summaryModule) })) });
const dashboardView = (state) => ({ status: state.status, customers: (state.customers ?? []).map(summaryCustomer), plans: state.plans ?? [], diagnostics: state.diagnostics ?? null });
const sameModule = (left, right) => normalizeModuleName(left) === normalizeModuleName(right);
const explainModule = (module) => {
  const rules = moduleRules(module);
  const indicators = (module.indicators ?? []).map((indicator) => {
    const rule = rules.find((item) => item.id === indicator.id);
    return { ...indicator, weight: indicator.weight ?? rule?.weight ?? null, rule: indicator.rule ?? (rule ? rule.kind === 'coverage' ? `proporção × peso (${rule.weight})` : rule.kind === 'boolean' ? `Sim = ${rule.weight}; Não = 0` : `> 0 = ${rule.weight}; 0 = 0` : null), reason: indicator.reason ?? (indicator.status === 'ausente' ? 'Indicador não disponível na fonte.' : indicator.status === 'dados_insuficientes' ? 'Componentes insuficientes para cálculo.' : null) };
  });
  return { ...module, classification: classifyAdoption(module.score), state: classifyAdoption(module.score) ?? module.state, usageReason: moduleAvailabilityReason({ ...module, indicators }) ?? module.usageReason ?? null, indicators };
};

function classifyRawFile(file) {
  try { return parseWorkbook(file.content, file.filename).type; } catch { return FILE_TYPES.UNKNOWN; }
}

async function mergeWithPersistedFiles(incoming) {
  const incomingTypes = incoming.map((file) => classifyRawFile(file));
  const hasIncomingClients = incomingTypes.includes(FILE_TYPES.CLIENTS);
  const hasIncomingIndicators = incomingTypes.some((type) => type !== FILE_TYPES.CLIENTS && type !== FILE_TYPES.UNKNOWN);
  if (hasIncomingClients && hasIncomingIndicators) return incoming;
  const state = await loadState({ withRawFiles: true });
  const persisted = (state.rawFiles ?? []).map((file) => ({ filename: file.filename, content: Buffer.from(file.content, 'base64') }));
  if (!persisted.length) return incoming;
  const baseFiles = hasIncomingClients ? incoming.filter((_, index) => incomingTypes[index] === FILE_TYPES.CLIENTS) : persisted.filter((file) => classifyRawFile(file) === FILE_TYPES.CLIENTS);
  const indicatorFiles = hasIncomingIndicators ? incoming.filter((_, index) => incomingTypes[index] !== FILE_TYPES.CLIENTS) : persisted.filter((file) => classifyRawFile(file) !== FILE_TYPES.CLIENTS);
  const matrixFiles = incoming.filter((_, index) => incomingTypes[index] === FILE_TYPES.MATRIX);
  const merged = [...baseFiles, ...indicatorFiles, ...matrixFiles];
  return [...new Map(merged.map((file) => [file.filename, file])).values()];
}

export async function handleIngestionRequest(request, response) {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET' && path === '/api/health') return json(response, 200, { ok: true, service: 'quarkrh-local-ingestion' });
  if (request.method === 'GET' && path === '/api/import/progress') return json(response, 200, processingProgress);
  if (request.method === 'GET' && path === '/api/data/status') return json(response, 200, statusView(await loadState()));
  if (request.method === 'GET' && path === '/api/data/dashboard') {
    const state = await loadState();
    return json(response, 200, { ...dashboardView(state), clickupSync: state.clickupSync ?? null });
  }
  if (request.method === 'POST' && path === '/api/clickup/sync') {
    try {
      progressStage('sincronizando_clickup', 0, 2);
      const current = await loadState({ withRawFiles: true });
      const currentRawFiles = current.rawFiles ?? [];
      const preservedFiles = currentRawFiles
        .map((file) => ({ filename: file.filename, content: Buffer.from(file.content, 'base64') }))
        .filter((file) => classifyRawFile(file) !== FILE_TYPES.CLIENTS);
      const preservedTypes = preservedFiles.map((file) => classifyRawFile(file));
      if (!preservedTypes.some((type) => type !== FILE_TYPES.UNKNOWN && type !== FILE_TYPES.MATRIX)) {
        return json(response, 422, { status: 'sem_indicadores_persistidos', errors: ['Sincronização cadastral interrompida: não há indicadores de uso persistidos para recalcular a carteira.'] });
      }
      const roster = await fetchClickUpRoster();
      progressStage('processando_carteira', 1, 2);
      const baseFile = { filename: `clickup-clientes-${new Date().toISOString().slice(0, 10)}.csv`, content: clickUpRosterCsv(roster.clients) };
      const files = [baseFile, ...preservedFiles];
      const inspected = await inspectFiles(files);
      if (!inspected.canProcess) return json(response, 422, { status: 'nao_processado', errors: inspected.errors, warnings: inspected.warnings });
      cachedState = null; cachedStateMtime = -1;
      const result = await processFiles(files, { onProgress: progressStage });
      if (!result.canProcess) return json(response, 422, { status: 'nao_processado', errors: result.errors, warnings: result.warnings });
      const syncedAt = new Date().toISOString();
      const clickupSync = {
        status: 'sincronizado', syncedAt,
        lists: roster.lists.map((list) => ({ id: list.id, name: list.name, taskCount: list.tasks.length, pages: list.pages.length, pageRequests: list.pageRequests })),
        baseCustomerCount: roster.sourceCounts.base, churnCustomerCount: roster.sourceCounts.churn,
        consolidatedCustomerCount: roster.clients.length,
        activeCustomerCount: roster.clients.filter((client) => client.active).length,
        churnOnlyCustomerCount: roster.clients.filter((client) => !client.active).length,
        duplicateCount: roster.duplicateDiagnostics.length,
        crossListDuplicateCount: roster.duplicateDiagnostics.filter((item) => item.sources.includes('BASE_CLIENTES_RH') && item.sources.includes('CHURN')).length,
        duplicateDiagnostics: roster.duplicateDiagnostics,
        sourceConflictCount: roster.duplicateDiagnostics.filter((item) => item.sourceConflicts.length).length,
      };
      const nextState = { status: 'processado', processedAt: syncedAt, files: result.files, summary: result.summary, diagnostics: { ...result.diagnostics, clickupSync }, relationRecords: result.relationRecords, customers: result.customers, plans: result.plans, warnings: result.warnings, errors: result.errors, clickupSync };
      const rawFiles = files.map((file) => ({ filename: file.filename, content: file.content.toString('base64') }));
      const saved = await persistState(nextState, rawFiles);
      processingProgress = { status: 'concluido', stage: 'concluido', completed: 2, total: 2, updatedAt: syncedAt };
      return json(response, 200, { status: 'sincronizado', processedAt: saved.processedAt, summary: saved.clickupSync, indicatorsPreserved: preservedTypes.filter((type) => type !== FILE_TYPES.MATRIX).length });
    } catch (error) {
      processingProgress = { status: 'erro', stage: 'erro', completed: 0, total: 0, updatedAt: new Date().toISOString() };
      return json(response, 502, { status: 'erro', errors: [error instanceof Error ? error.message : 'Não foi possível sincronizar com ClickUp.'] });
    }
  }
  if (request.method === 'GET' && path === '/api/data/customer') {
    const customerName = new URL(request.url, 'http://localhost').searchParams.get('name');
    const state = await loadState();
    const customer = state.customers?.find((item) => item.clienteNome === customerName);
    return customer ? json(response, 200, customerDetail(customer)) : json(response, 404, { error: 'Cliente não encontrado.' });
  }
  if (request.method === 'GET' && path === '/api/data/module') {
    const params = new URL(request.url, 'http://localhost').searchParams;
    const state = await loadState();
    const customer = state.customers?.find((item) => item.clienteNome === params.get('customer'));
    const unitId = params.get('unit_id');
    const unitName = params.get('unit_name');
    const unit = unitId !== null ? customer?.units?.find((item) => String(item.unitId) === unitId) : unitName !== null ? customer?.units?.find((item) => item.unitName === unitName) : null;
    const scope = unitId !== null || unitName !== null ? unit : customer;
    const module = scope?.modules?.find((item) => sameModule(item.name, params.get('module') ?? ''));
    return module ? json(response, 200, explainModule(module)) : json(response, 404, { error: 'Módulo não encontrado para este cliente/unidade.' });
  }
  if (request.method === 'POST' && path === '/api/import/reprocess') {
    progressStage('lendo_arquivos', 0, 0);
    const state = await loadState({ withRawFiles: true });
    if (!state.rawFiles?.length) return json(response, 422, { status: 'nenhum_lote_reprocessavel', errors: ['Nenhum lote processável foi persistido.'] });
    const rawFiles = state.rawFiles;
    const rawFilesArchive = state.rawFilesArchive;
    const files = rawFiles.map((file) => ({ filename: file.filename, content: Buffer.from(file.content, 'base64') }));
    cachedState = null; cachedStateMtime = -1;
    for (const key of Object.keys(state)) if (!['rawFiles', 'rawFilesArchive'].includes(key)) delete state[key];
    const result = await processFiles(files, { onProgress: progressStage });
    if (!result.canProcess) return json(response, 422, { ...result, status: 'nao_processado' });
    const next = { status: 'processado', processedAt: new Date().toISOString(), files: result.files, summary: result.summary, diagnostics: { ...result.diagnostics, clickupSync: state.clickupSync ?? null }, relationRecords: result.relationRecords, customers: result.customers, plans: result.plans, warnings: result.warnings, errors: result.errors, rawFilesArchive, clickupSync: state.clickupSync ?? null };
    const compactState = await persistState(next, rawFiles);
    processingProgress = { status: 'concluido', stage: 'concluido', completed: 1, total: 1, updatedAt: new Date().toISOString() };
    return json(response, 200, { status: 'processado', files: compactState.files, summary: compactState.summary, diagnostics: compactState.diagnostics, warnings: compactState.warnings, errors: compactState.errors });
  }
  if (request.method !== 'POST' || !['/api/import/inspect', '/api/import/process'].includes(path)) return false;
  try {
    const incomingFiles = parseMultipart(await bodyBuffer(request), request.headers['content-type']);
    // Keep the uploaded-file classification in this request scope. The route
    // uses it after mergeWithPersistedFiles to preserve ClickUp sync metadata.
    const incomingTypes = incomingFiles.map((file) => classifyRawFile(file));
    const files = await mergeWithPersistedFiles(incomingFiles);
    if (path.endsWith('/process')) {
      progressStage('validando_estrutura', 0, files.length);
      const inspected = await inspectFiles(files);
      if (!inspected.canProcess) { processingProgress = { status: 'erro', stage: 'erro', completed: 0, total: files.length, updatedAt: new Date().toISOString() }; return json(response, 422, { ...inspected, status: 'nao_processado' }); }
      const previousState = await loadState();
      cachedState = null; cachedStateMtime = -1;
      const result = await processFiles(files, { onProgress: progressStage });
      if (!result.canProcess) { processingProgress = { status: 'erro', stage: 'erro', completed: 0, total: files.length, updatedAt: new Date().toISOString() }; return json(response, 422, { ...result, status: 'nao_processado' }); }
      progressStage('salvando_dados', 0, 1);
      const state = { status: 'processado', processedAt: new Date().toISOString(), files: result.files, rawFiles: files.map((file) => ({ filename: file.filename, content: file.content.toString('base64') })), summary: result.summary, diagnostics: { ...result.diagnostics, clickupSync: incomingTypes.includes(FILE_TYPES.CLIENTS) ? null : previousState.clickupSync ?? null }, relationRecords: result.relationRecords, customers: result.customers, plans: result.plans, warnings: result.warnings, errors: result.errors, clickupSync: incomingTypes.includes(FILE_TYPES.CLIENTS) ? null : previousState.clickupSync ?? null };
      const persistenceStartedAt = Date.now();
      const compactState = await persistState(state);
      progressStage('atualizando_carteira', 1, 1);
      processingProgress = { status: 'concluido', stage: 'concluido', completed: 1, total: 1, updatedAt: new Date().toISOString() };
      return json(response, 200, { status: 'processado', files: compactState.files, summary: { ...compactState.summary, persistenceMs: Date.now() - persistenceStartedAt }, diagnostics: compactState.diagnostics, warnings: compactState.warnings, errors: compactState.errors });
    }
    const result = await inspectFiles(files);
    return json(response, 200, { ...result, status: result.canProcess ? 'pronto_para_processar' : 'requer_correcao' });
  } catch (error) {
    processingProgress = { status: 'erro', stage: 'erro', completed: 0, total: 0, updatedAt: new Date().toISOString() };
    return json(response, 400, { status: 'erro', errors: [error instanceof Error ? error.message : 'Falha ao ler os arquivos.'] });
  }
}

export { FILE_TYPES };
