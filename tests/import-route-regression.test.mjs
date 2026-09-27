import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const originalCwd = process.cwd();
const temporaryCwd = await mkdtemp(join(tmpdir(), 'quarkrh-import-route-'));
let server;

try {
  process.chdir(temporaryCwd);
  const { handleIngestionRequest } = await import('../scripts/ingestion/server.mjs');
  server = createServer(async (request, response) => {
    const handled = await handleIngestionRequest(request, response);
    if (handled === false) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const createBatch = () => {
    const body = new FormData();
    body.append('files', new Blob(['Task Name,6. PLANO: (drop down)\nAtlas,Premium\n'], { type: 'text/csv' }), 'clientes.csv');
    body.append('files', new Blob(['cliente_nome,unidade_id,unidade_nome,indicador,valor,competencia\nAtlas,U1,Unidade Natal,ponto_registrantes,20,2026-08\n'], { type: 'text/csv' }), 'frequencia.csv');
    return body;
  };

  const inspectedResponse = await fetch(`${baseUrl}/api/import/inspect`, { method: 'POST', body: createBatch() });
  const inspected = await inspectedResponse.json();
  assert.equal(inspectedResponse.status, 200);
  assert.equal(inspected.status, 'pronto_para_processar');
  assert.equal(inspected.summary.recognizedFiles, 2);

  const processResponse = await fetch(`${baseUrl}/api/import/process`, { method: 'POST', body: createBatch() });
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

  console.log('Import route regression passed: inspect, classify, process, persist and dashboard projection.');
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  process.chdir(originalCwd);
  await rm(temporaryCwd, { recursive: true, force: true });
}
