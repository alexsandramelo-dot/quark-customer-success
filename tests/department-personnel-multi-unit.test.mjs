import assert from 'node:assert/strict';
import { processFiles } from '../scripts/ingestion/core.mjs';

const base = 'Task Name,11. CSM Responsável (users),6. PLANO: (drop down)\nDP Única,CSM,Frequência Básico\nDP Multi,CSM,Frequência Básico\nDP Zero,CSM,Frequência Básico\nDP Ausente,CSM,Frequência Básico\nDP ANY Falso,CSM,Frequência Básico\nDP ANY Parcial,CSM,Frequência Básico\nDP Colaborador Parcial,CSM,Frequência Básico';
const headers = 'cliente_id,cliente_nome,unidade_id,unidade_nome,dados_empresa_preenchidos,colaboradores_ativos_importacao_true,colaboradores_ativos_importacao_false,qtd_setores,qtd_cargos,qtd_modelos_documentos,avaliacao_experiencia_configurada';
const rows = [
  '1,DP Única,U1,Sede,true,50,200,24,96,0,false',
  '2,DP Multi,U2,Natal,true,50,200,5,10,1,true',
  '2,DP Multi,U3,Recife,false,0,250,20,30,5,false',
  '2,DP Multi,U4,Fortaleza,,0,0,0,0,0,',
  '3,DP Zero,U5,Centro,true,0,0,24,96,0,false',
  '4,DP Ausente,U6,Matriz,true,,,24,96,0,true',
  '5,DP ANY Falso,U7,Natal,false,0,0,1,1,1,false',
  '5,DP ANY Falso,U8,Recife,false,0,0,1,1,1,false',
  '6,DP ANY Parcial,U9,Natal,false,0,0,1,1,1,false',
  '6,DP ANY Parcial,U10,Recife,,0,0,1,1,1,',
  '7,DP Colaborador Parcial,U11,Natal,true,,20,1,1,1,false',
  '7,DP Colaborador Parcial,U12,Recife,true,0,5,1,1,1,false',
];
const result = await processFiles([{filename:'clientes.csv',content:Buffer.from(base)},{filename:'Módulo DP.csv',content:Buffer.from([headers,...rows].join('\n'))}]);
assert.equal(result.canProcess,true);
const get=(name)=>result.customers.find((customer)=>customer.clienteNome===name);
const dp=(customer)=>customer.modules.find((module)=>module.name==='Departamento Pessoal');
const scoreRow=(customer)=>dp(customer).indicators.find((indicator)=>indicator.id==='employees-total');
const evidence=(customer,id)=>dp(customer).consolidationDetails.find((item)=>item.functionalId===id);

const single=get('DP Única');
assert.equal(scoreRow(single).value,250);
assert.equal(scoreRow(single).score,30);
assert.equal(evidence(single,'employees-imported').consolidatedValue,50);
assert.equal(evidence(single,'employees-direct').consolidatedValue,200);
assert.equal(single.units[0].modules.find((module)=>module.name==='Departamento Pessoal').indicators.find((indicator)=>indicator.id==='employees-total').value,250);
assert.equal(dp(single).score,63.75);
assert.equal(single.overallScore,dp(single).score);
assert.equal(single.evaluatedModules,1);

const multi=get('DP Multi');
assert.equal(scoreRow(multi).value,500,'customer matrix must sum the unit totals 250+250');
assert.equal(scoreRow(multi).score,30);
assert.equal(evidence(multi,'employees-imported').consolidatedValue,50);
assert.equal(evidence(multi,'employees-direct').consolidatedValue,450);
assert.deepEqual(evidence(multi,'employees-direct').unitValues.map((unit)=>Number(unit.value)),[200,250,0]);
assert.equal(dp(multi).indicators.find((indicator)=>indicator.id==='company-configured').value,true,'ANY true+false+null must be true');
assert.equal(dp(multi).indicators.find((indicator)=>indicator.id==='company-configured').score,15);
assert.equal(dp(multi).indicators.find((indicator)=>indicator.id==='experience-evaluation').value,true);
for (const [index,expected] of [[0,250],[1,250],[2,0]]) {
  const unitDp=multi.units[index].modules.find((module)=>module.name==='Departamento Pessoal');
  assert.equal(unitDp.indicators.find((indicator)=>indicator.id==='employees-total').value,expected,'unit view must keep only its own quantity');
}
assert.equal(dp(multi).score,66.25);
assert.equal(multi.overallScore,dp(multi).score);
const numericUnitScores=multi.units.map((unit)=>unit.overallScore).filter((score)=>score!==null);
assert.notEqual(multi.overallScore,numericUnitScores.reduce((sum,value)=>sum+value,0)/numericUnitScores.length,'customer overall must not average unit scores');
assert.equal(multi.modules.find((module)=>module.name==='Férias').contractStatus,'nao_incluso');
assert.equal(multi.evaluatedModules,1,'non-contracted modules stay outside overallScore');

const zero=get('DP Zero');
assert.equal(scoreRow(zero).value,0);
assert.equal(scoreRow(zero).score,0);
assert.equal(dp(zero).score,33.75);
const absent=get('DP Ausente');
assert.equal(scoreRow(absent).value,null);
assert.equal(scoreRow(absent).score,null);
assert.equal(evidence(absent,'employees-imported').consolidatedValue,null);
assert.equal(dp(absent).score,null);

const anyFalse=get('DP ANY Falso');
assert.equal(dp(anyFalse).indicators.find((indicator)=>indicator.id==='company-configured').value,false);
assert.equal(dp(anyFalse).indicators.find((indicator)=>indicator.id==='company-configured').score,0);
const anyPartial=get('DP ANY Parcial');
assert.equal(dp(anyPartial).indicators.find((indicator)=>indicator.id==='company-configured').value,null,'ANY false+null follows existing incomplete-data semantics');
assert.equal(dp(anyPartial).indicators.find((indicator)=>indicator.id==='experience-evaluation').value,null,'experience ANY semantics must be unchanged');
const partialEmployee=get('DP Colaborador Parcial');
assert.equal(evidence(partialEmployee,'employees-imported').consolidatedValue,null);
assert.equal(scoreRow(partialEmployee).value,null,'missing employee source must not be converted to zero');

console.log('DP integration tests passed: single/multi-unit SUM, unit isolation, ANY semantics, zero/null, quantitative bands, contracts, overall and no unit-score averaging');
