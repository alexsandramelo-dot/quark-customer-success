import { normalizeClientName } from './core.mjs';

const API_BASE = 'https://api.clickup.com/api/v2';
const FUNCTIONAL_FIELDS = {
  csm: ['11. csm responsável'],
  plan: ['6. plano:'],
  journey: ['1. jornada do cliente:'],
  signedAt: ['7. data de assinatura'],
  mrr: ['5. mrr'],
  category: ['9. categoria rh:'],
  goLiveAt: ['17. data de virada chave'],
};
const listSource = (listId, name) => listId === '901113131199' ? 'BASE_CLIENTES_RH' : listId === '901113348988' ? 'CHURN' : name;
const normalText = (value) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ');

function optionText(option) {
  if (typeof option === 'string' || typeof option === 'number') return normalText(option);
  if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
  for (const key of ['name', 'label', 'value']) {
    const text = optionText(option[key]);
    if (text) return text;
  }
  return null;
}

function dropdownValue(value, field) {
  const options = field.type_config?.options ?? [];
  if (typeof value === 'object' && !Array.isArray(value)) {
    const directLabel = optionText(value);
    if (directLabel) return directLabel;
    const matched = options.find((option) => value.id !== undefined && String(option?.id) === String(value.id));
    return optionText(matched);
  }
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/u.test(value))) {
    const index = Number(value);
    const matched = options.find((option) => Number(option?.orderindex) === index) ?? options[index];
    return optionText(matched);
  }
  return typeof value === 'string' ? normalText(value) : null;
}

function formulaText(value) {
  if (typeof value === 'string' || typeof value === 'number') return normalText(value) || null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const key of ['value', 'result', 'text', 'name', 'label', 'calculated_value']) {
    const text = formulaText(value[key]);
    if (text) return text;
  }
  return null;
}

export function parseClickUpListIds(value) {
  return String(value ?? '').split(',').map((id) => id.trim()).filter(Boolean);
}

async function requestJson(path, token, fetchImpl = fetch) {
  let response;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetchImpl(`${API_BASE}${path}`, { headers: { Authorization: token, Accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * (attempt + 1), 5000)));
  }
  if (!response?.ok) {
    let code = '';
    try { code = (await response.json())?.err ?? ''; } catch { /* omit response body */ }
    throw new Error(`ClickUp API HTTP ${response?.status ?? 'unknown'}${code ? ` (${code})` : ''}`);
  }
  return response.json();
}

export async function fetchAllClickUpTasks(listId, { token, includeClosed = true, fetchImpl = fetch, request = requestJson } = {}) {
  if (!token) throw new Error('CLICKUP_API_TOKEN não está configurado no servidor.');
  const tasks = [];
  const pages = [];
  for (let page = 0; page < 1000; page += 1) {
    const response = await request(`/list/${encodeURIComponent(listId)}/task?page=${page}&include_closed=${includeClosed}&limit=100`, token, fetchImpl);
    const current = response.tasks ?? [];
    if (!Array.isArray(current) || current.length > 100) throw new Error(`Resposta de paginação inválida para a lista ${listId}.`);
    if (!current.length) return { tasks, pages, pageRequests: pages.length + 1 };
    pages.push({ page, taskCount: current.length });
    tasks.push(...current);
  }
  throw new Error(`Limite de segurança da paginação excedido para a lista ${listId}.`);
}

function schemaField(fields, functionalField) {
  const patterns = FUNCTIONAL_FIELDS[functionalField] ?? [];
  return fields.find((field) => patterns.includes(normalizeClientName(field.name))) ?? null;
}

function valueFromTask(task, field) {
  if (!field) return null;
  const entry = (task.custom_fields ?? []).find((item) => String(item.id) === String(field.id));
  if (!entry || entry.value === null || entry.value === undefined || entry.value === '') return null;
  let value = entry.value;
  if (field.type === 'drop_down') {
    value = dropdownValue(value, field);
  } else if (field.type === 'users') {
    const values = Array.isArray(value) ? value : [value];
    value = values.map((user) => typeof user === 'string' ? user : user?.username ?? user?.name).filter(Boolean);
  } else if (field.type === 'date') {
    const timestamp = Number(value);
    if (Number.isFinite(timestamp)) value = new Date(timestamp).toISOString().slice(0, 10);
  } else if (field.type === 'currency') {
    const numeric = Number(String(value).replace(',', '.'));
    if (Number.isFinite(numeric)) value = numeric;
  } else if (field.type === 'formula') value = formulaText(value);
  return value;
}

function normalizeTask(task, listId, listName, fields) {
  const name = normalText(task.name);
  const normalizedName = normalizeClientName(name);
  const values = Object.fromEntries(Object.keys(FUNCTIONAL_FIELDS).map((key) => [key, valueFromTask(task, schemaField(fields, key))]));
  return { name, normalizedName, listId, source: listSource(listId, listName), active: listId === '901113131199', values, taskId: task.id, status: task.status?.status ?? null };
}

const comparable = (value) => {
  if (Array.isArray(value)) return normalizeClientName(value.join(', '));
  if (value && typeof value === 'object') return normalizeClientName(value.name ?? JSON.stringify(value));
  return normalizeClientName(value ?? '');
};

export function consolidateClickUpTasks(listResults) {
  const grouped = new Map();
  for (const list of listResults) {
    const fields = list.fields ?? [];
    for (const task of list.tasks ?? []) {
      const record = normalizeTask(task, list.id, list.name, fields);
      if (!record.normalizedName) continue;
      const group = grouped.get(record.normalizedName) ?? [];
      group.push(record);
      grouped.set(record.normalizedName, group);
    }
  }
  const clients = [];
  const duplicateDiagnostics = [];
  for (const records of grouped.values()) {
    const activeRecords = records.filter((record) => record.source === 'BASE_CLIENTES_RH');
    const primary = activeRecords[0] ?? records[0];
    const sources = [...new Set(records.map((record) => record.source))];
    const conflicts = [];
    if (records.length > 1) {
      const comparedRecords = records.filter((record) => record.source !== primary.source || records.filter((item) => item.source === record.source).length > 1);
      for (const field of Object.keys(FUNCTIONAL_FIELDS)) {
        const values = [...new Set(records.map((record) => comparable(record.values[field])).filter(Boolean))];
        const activeValue = activeRecords[0]?.values[field] ?? null;
        const activeMissingButOtherHasValue = activeRecords.length > 0 && !comparable(activeValue) && records.some((record) => record.source !== 'BASE_CLIENTES_RH' && comparable(record.values[field]));
        if (values.length > 1 || activeMissingButOtherHasValue) conflicts.push({ field, activeValue, records: comparedRecords.map((record) => ({ source: record.source, listId: record.listId, value: record.values[field] })), ...(activeMissingButOtherHasValue ? { activeValueMissing: true } : {}) });
      }
    }
    const client = { ...primary, active: activeRecords.length > 0, sources, sourceConflicts: conflicts };
    clients.push(client);
    if (records.length > 1) duplicateDiagnostics.push({ clienteNome: primary.name, sources, records: records.map(({ listId, taskId, status }) => ({ listId, taskId, status })), sourceConflicts: conflicts });
  }
  clients.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  return { clients, duplicateDiagnostics, sourceCounts: { base: listResults.find((list) => list.id === '901113131199')?.tasks.length ?? 0, churn: listResults.find((list) => list.id === '901113348988')?.tasks.length ?? 0 } };
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/gu, '""')}"`;
};

export function clickUpRosterCsv(clients) {
  const headers = ['Task Name', '6. PLANO: (drop down)', '1. JORNADA DO CLIENTE: (drop down)', '11. CSM Responsável (users)', '7. DATA DE ASSINATURA (date)', '5. MRR (currency)', '9. CATEGORIA RH: (formula)', '17. DATA DE VIRADA CHAVE (date)', 'clickup_active', 'clickup_sources', 'clickup_conflicts'];
  const rows = clients.map((client) => [client.name, client.values.plan, client.values.journey, client.values.csm, client.values.signedAt, client.values.mrr, client.values.category, client.values.goLiveAt, client.active, client.sources.join('|'), JSON.stringify(client.sourceConflicts)]);
  return Buffer.from([headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'), 'utf8');
}

export async function fetchClickUpRoster({ token = process.env.CLICKUP_API_TOKEN, listIds = parseClickUpListIds(process.env.CLICKUP_QUARKRH_LIST_IDS), fetchImpl = fetch, request = requestJson } = {}) {
  if (!token) throw new Error('CLICKUP_API_TOKEN não está configurado no servidor.');
  if (listIds.length !== 2 || listIds[0] !== '901113131199' || listIds[1] !== '901113348988') throw new Error('CLICKUP_QUARKRH_LIST_IDS deve conter as duas listas QuarkRH confirmadas.');
  await request('/user', token, fetchImpl);
  const lists = await Promise.all(listIds.map(async (id) => {
    const listResponse = await request(`/list/${id}`, token, fetchImpl);
    const list = listResponse.list ?? listResponse;
    const schemaResponse = await request(`/list/${id}/field`, token, fetchImpl);
    const tasks = await fetchAllClickUpTasks(id, { token, includeClosed: true, fetchImpl, request });
    return { id, name: list.name ?? '', fields: schemaResponse.fields ?? schemaResponse.custom_fields ?? [], tasks: tasks.tasks, pages: tasks.pages, pageRequests: tasks.pageRequests };
  }));
  const consolidated = consolidateClickUpTasks(lists);
  return { lists, ...consolidated };
}
