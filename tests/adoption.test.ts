import { calculateAdoptionModule } from '../src/domain/adoption/engine.ts';

const complete = calculateAdoptionModule('Departamento Pessoal', { 'company-configured': true, sectors: 2, positions: 3, 'document-model': 1, 'experience-evaluation': true, 'employees-imported': 24, 'employees-direct': 0 });
if (complete.score !== 34.75 || complete.status !== 'calculado') throw new Error(`Pontuação quantitativa incorreta: ${complete.score}.`);
if (complete.indicators.every((indicator) => indicator.contribution === null)) throw new Error('Explicabilidade sem contribuições.');

const zero = calculateAdoptionModule('Folha', { 'payroll-configured': false, 'payroll-items': 0, 'payroll-created-history': 0 });
if (zero.score !== 0 || zero.status !== 'calculado') throw new Error('Zero conhecido não foi preservado.');

const insufficient = calculateAdoptionModule('Administração', { administrators: 1, 'active-users': 4 });
if (insufficient.score !== null || insufficient.usage.status !== 'dados_insuficientes') throw new Error('Denominador ausente deveria gerar dados_insuficientes.');

const clamped = calculateAdoptionModule('Administração', { administrators: 1, 'active-users': 120, 'expected-users': 100 });
if (clamped.usage.score !== 40) throw new Error('Cobertura acima de 100% não foi limitada a 40.');

const notContracted = calculateAdoptionModule('Férias', {}, false);
if (notContracted.status !== 'nao_contratado' || notContracted.score !== null) throw new Error('Módulo não contratado recebeu score.');

const seasonal = calculateAdoptionModule('Férias', {}, true);
if (seasonal.temporalType !== 'SAZONAL') throw new Error('Metadado sazonal não preservado.');

console.log('Adoption matrix tests passed: 6 scenarios');
