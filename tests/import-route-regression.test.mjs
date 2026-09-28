import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const originalCwd = process.cwd();
const temporaryCwd = await mkdtemp(join(tmpdir(), 'quarkrh-import-route-'));
let server;

try {
  process.chdir(temporaryCwd);
  process.env.IMPORT_PASSWORD = 'test-only-import-password';
  const { handleIngestionRequest, synchronizeClickUp } = await import('../scripts/ingestion/server.mjs');
  server = createServer(async (request, response) => {
    const handled = await handleIngestionRequest(request, response);
    if (handled === false) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const blockedResponse = await fetch(`${baseUrl}/api/import/progress`);
  assert.equal(blockedResponse.status, 401, 'import area APIs require authentication');
  const authResponse = await fetch(`${baseUrl}/api/import/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'incorrect' }) });
  assert.equal(authResponse.status, 401, 'incorrect passwords are rejected');
  const validAuth = await fetch(`${baseUrl}/api/import/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.IMPORT_PASSWORD }) });
  assert.equal(validAuth.status, 200);
  assert.equal(validAuth.headers.get('set-cookie'), null, 'authentication is not persisted in a browser cookie');
  const { sessionToken } = await validAuth.json();
  assert.equal(typeof sessionToken, 'string');
  assert.ok(sessionToken.length > 0);
  const statusAfterReload = await fetch(`${baseUrl}/api/import/auth`).then((response) => response.json());
  assert.equal(statusAfterReload.authenticated, false, 'a fresh page load cannot reuse the previous authorization');
  const assertBlockedWithoutToken = async (url, init) => assert.equal((await fetch(url, init)).status, 401, 'protected endpoints require the in-memory session token');
  await assertBlockedWithoutToken(`${baseUrl}/api/import/progress`);
  await assertBlockedWithoutToken(`${baseUrl}/api/clickup/sync`, { method: 'POST' });

  const createBatch = () => {
    const body = new FormData();
    body.append('files', new Blob(['Task Name,6. PLANO: (drop down)\nAtlas,Premium\n'], { type: 'text/csv' }), 'clientes.csv');
    body.append('files', new Blob(['cliente_nome,unidade_id,unidade_nome,indicador,valor,competencia\nAtlas,U1,Unidade Natal,ponto_registrantes,20,2026-08\n'], { type: 'text/csv' }), 'frequencia.csv');
    return body;
  };

  const inspectedResponse = await fetch(`${baseUrl}/api/import/inspect`, { method: 'POST', headers: { 'X-Import-Session': sessionToken }, body: createBatch() });
  const inspected = await inspectedResponse.json();
  assert.equal(inspectedResponse.status, 200);
  assert.equal(inspected.status, 'pronto_para_processar');
  assert.equal(inspected.summary.recognizedFiles, 2);

  const processResponse = await fetch(`${baseUrl}/api/import/process`, { method: 'POST', headers: { 'X-Import-Session': sessionToken }, body: createBatch() });
  const processed = await processResponse.json();
  assert.equal(processResponse.status, 200);
  assert.equal(processed.status, 'processado');
  assert.equal(processed.summary.recognizedFiles, 2);

  const statusResponse = await fetch(`${baseUrl}/api/data/status`);
  const status = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(status.status, 'processado');
  assert.equal(status.files.length, 2);

  const dashboardResponse = await fetch(`${baseUrl}/api/data/dashboard`);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboard.customers.length, 1);
  assert.equal(dashboard.customers[0].clienteNome, 'Atlas');
  assert.ok(Array.isArray(dashboard.customers[0].moduleMetrics));

  const stateFile = join(temporaryCwd, '.local-data', 'processed-state.json');
  const beforeFailedSync = JSON.parse(await readFile(stateFile, 'utf8'));
  const beforeArchive = await readFile(join(temporaryCwd, '.local-data', beforeFailedSync.rawFilesArchive));
  const previousClickUpToken = process.env.CLICKUP_API_TOKEN;
  const previousClickUpLists = process.env.CLICKUP_QUARKRH_LIST_IDS;
  const originalFetch = globalThis.fetch;
  let mockedClickUpRequests = 0;
  process.env.CLICKUP_API_TOKEN = 'test-only-clickup-token';
  process.env.CLICKUP_QUARKRH_LIST_IDS = '901113131199,901113348988';
  globalThis.fetch = async () => { mockedClickUpRequests += 1; throw new Error('mocked network: no external request'); };
  let syncResults;
  try { syncResults = await Promise.allSettled([synchronizeClickUp(), synchronizeClickUp()]); }
  finally {
    globalThis.fetch = originalFetch;
    if (previousClickUpToken === undefined) delete process.env.CLICKUP_API_TOKEN; else process.env.CLICKUP_API_TOKEN = previousClickUpToken;
    if (previousClickUpLists === undefined) delete process.env.CLICKUP_QUARKRH_LIST_IDS; else process.env.CLICKUP_QUARKRH_LIST_IDS = previousClickUpLists;
  }
  assert.equal(syncResults.filter((result) => result.status === 'rejected').length, 2, 'both callers observe the same mocked failure');
  assert.equal(mockedClickUpRequests, 1, 'two simultaneous callers share a single ClickUp pipeline execution');
  const afterFailedSync = JSON.parse(await readFile(stateFile, 'utf8'));
  const afterArchive = await readFile(join(temporaryCwd, '.local-data', afterFailedSync.rawFilesArchive));
  assert.deepEqual(afterFailedSync.customers, beforeFailedSync.customers, 'failed synchronization preserves the last valid processed customer base');
  assert.deepEqual(afterFailedSync.files, beforeFailedSync.files, 'failed synchronization preserves processed file metadata');
  assert.equal(afterFailedSync.processedAt, beforeFailedSync.processedAt, 'failed synchronization does not advance the processed base timestamp');
  assert.equal(afterFailedSync.rawFilesArchive, beforeFailedSync.rawFilesArchive);
  assert.deepEqual(afterArchive, beforeArchive, 'failed synchronization preserves the raw source archive byte for byte');
  assert.equal(afterFailedSync.clickupSync.lastAttemptResult, 'erro');
  assert.ok(afterFailedSync.clickupSync.lastAttemptAt);

  const logoutResponse = await fetch(`${baseUrl}/api/import/auth`, { method: 'DELETE', headers: { 'X-Import-Session': sessionToken } });
  assert.equal(logoutResponse.status, 200);
  await assertBlockedWithoutToken(`${baseUrl}/api/import/progress`, { headers: { 'X-Import-Session': sessionToken } });

  console.log('Import route regression passed: fresh in-memory auth, protected endpoints, revocation, inspect, process and dashboard projection.');
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  process.chdir(originalCwd);
  delete process.env.IMPORT_PASSWORD;
  await rm(temporaryCwd, { recursive: true, force: true });
}
