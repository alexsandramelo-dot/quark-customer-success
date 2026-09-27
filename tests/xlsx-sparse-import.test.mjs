import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { FILE_TYPES, buildNormalizedCustomers, normalizeWorksheet, parseWorkbook, processFiles } from '../scripts/ingestion/core.mjs';

// Simulate the sparse worksheet object produced by XLSX.read when !ref is inflated
// to Excel's 1,048,576 row limit but only ~1,018 customer records contain values.
const sparse = { '!ref': 'A1:C1048576' };
sparse.A1 = { t: 's', v: 'Task Name' };
sparse.B1 = { t: 's', v: '11. CSM Responsável (users)' };
sparse.C1 = { t: 's', v: '6. PLANO: (drop down)' };
for (let i = 0; i < 1018; i += 1) {
  const row = i + 2;
  if (i === 499) {
    sparse[`B${row}`] = { t: 's', v: 'CSM sem Task Name' };
    continue;
  }
  sparse[`A${row}`] = { t: 's', v: `Cliente ${i + 1}` };
  if (i !== 10) sparse[`B${row}`] = { t: 's', v: i === 11 ? '' : `CSM ${i + 1}` };
  if (i !== 11) sparse[`C${row}`] = { t: 's', v: `Plano ${i + 1}` };
}
sparse.A1020 = { t: 's', v: 'Cliente 1018' };
sparse.B1021 = { t: 's', v: 'CSM sem cliente' };
sparse.C1021 = { t: 's', v: 'Plano sem cliente' };
sparse.C1048576 = { t: 's', v: '' };
const normalizedSparse = normalizeWorksheet(sparse);
assert.equal(normalizedSparse.declaredRowCount, 1_048_576);
assert.equal(normalizedSparse.rows.length, 1018);
assert.ok(normalizedSparse.rows.every(row => row.task_name));
assert.equal(normalizedSparse.rows.some(row => row.task_name === 'CSM sem Task Name'), false);
assert.equal(normalizedSparse.rows.some(row => row.task_name === 'Cliente 11' && row['11_csm_responsavel_users'] !== null), false);
assert.equal(normalizedSparse.rows.find(row => row.task_name === 'Cliente 12')['6_plano_drop_down'], null);
const sparseStart = performance.now();
const sparseCustomers = await buildNormalizedCustomers([{ type: FILE_TYPES.CLIENTS, rows: normalizedSparse.rows }]);
const sparseElapsedMs = performance.now() - sparseStart;
assert.equal(sparseCustomers.customers.length, 1018);
assert.equal(sparseCustomers.customers[0].modules.length, 18);

// Exercise the actual XLSX parse and complete import with a client-only workbook.
const aoa = [['Task Name', '11. CSM Responsável (users)', '6. PLANO: (drop down)']];
for (let i = 1; i <= 1018; i += 1) {
  aoa.push([`Cliente real ${i}`, i === 1 ? '' : `CSM ${i}`, i === 2 ? '' : 'Essencial']);
  if (i === 500) aoa.push(['', 'CSM órfão', 'Plano órfão']);
}
aoa.push(['', '', '']);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Clientes');
const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
const parsed = parseWorkbook(buffer, 'clientes.xlsx');
assert.equal(parsed.type, FILE_TYPES.CLIENTS);
assert.equal(parsed.warnings.some(warning => warning.includes('Competência não informada')), false);
assert.equal(parsed.rowCount, 1018);

const start = performance.now();
const result = await processFiles([{ filename: 'clientes.xlsx', content: buffer }]);
const elapsedMs = performance.now() - start;
assert.equal(result.canProcess, true);
assert.equal(result.customers.length, 1018);
assert.equal(result.customers[0].modules.length, 18);
assert.equal(result.customers[0].csm_responsavel, null);
assert.equal(result.customers[1].plano, null);
assert.equal(result.diagnostics.clientsWithoutCsm, 1);
assert.equal(result.diagnostics.clientsWithoutPlan, 1);
assert.equal(result.files[0].rowCount, 1018);
const withUnknown = await processFiles([{ filename: 'clientes.xlsx', content: buffer }, { filename: 'arquivo-corrompido.xlsx', content: Buffer.from('not-an-xlsx') }]);
assert.equal(withUnknown.canProcess, true);
assert.equal(withUnknown.customers.length, 1018);
assert.equal(withUnknown.diagnostics.filesIgnored.length, 1);

console.log(`Sparse XLSX import passed: 1,048,576 declared rows, 1,018 normalized customers, ${Math.round(sparseElapsedMs)} ms customer processing; actual XLSX import ${Math.round(elapsedMs)} ms`);
