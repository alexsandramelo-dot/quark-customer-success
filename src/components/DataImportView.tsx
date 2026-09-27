import { apiUrl } from '../api';
import React, { useEffect, useMemo, useState } from 'react';
import { CircleHelp, FileSpreadsheet, FolderOpen, LoaderCircle, Upload } from 'lucide-react';
import { classifyIndicatorFiles } from '../domain/import/fileSelection';
import { formatProcessedDate } from '../domain/customer/format';
import { AppSidebar } from './AppSidebar';

type Props = { back: () => void; hasCurrentData?: boolean; sidebarCollapsed: boolean; onToggleSidebar: () => void };
type DirectoryInput = HTMLInputElement & { webkitdirectory?: boolean; directory?: boolean };
const supported = /\.(csv|xlsx|xls)$/i;
const stages = ['Enviando arquivos', 'Lendo planilhas', 'Validando dados', 'Relacionando clientes', 'Identificando unidades', 'Consolidando indicadores', 'Calculando adoção', 'Salvando dados', 'Atualizando carteira'];
const stageIndex: Record<string, number> = { enviando_arquivos: 0, lendo_arquivos: 1, validando_estrutura: 2, validando_dados: 2, relacionando_clientes: 3, identificando_unidades: 4, consolidando_indicadores: 5, calculando_adocao: 6, salvando_dados: 7, finalizando: 7, atualizando_carteira: 8, concluido: 8, erro: 0 };

export function DataImportView({ back, hasCurrentData = false, sidebarCollapsed, onToggleSidebar }: Props) {
  const [clientFile, setClientFile] = useState<File | null>(null);
  const [indicatorFiles, setIndicatorFiles] = useState<File[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [progress, setProgress] = useState<any>(null);
  const [currentStatus, setCurrentStatus] = useState<any>(null);
  useEffect(() => { const refresh = () => fetch(apiUrl('/api/data/status')).then((response) => response.json()).then(setCurrentStatus).catch(() => setCurrentStatus(null)); void refresh(); window.addEventListener('quarkrh:data-updated', refresh); return () => window.removeEventListener('quarkrh:data-updated', refresh); }, []);
  const files = useMemo(() => clientFile ? [clientFile, ...indicatorFiles] : indicatorFiles, [clientFile, indicatorFiles]);

  useEffect(() => {
    if (!busy) return;
    let active = true;
    const poll = async () => { try { const response = await fetch(apiUrl('/api/import/progress')); const value = await response.json(); if (active) setProgress(value); } catch { /* progresso local pode ainda estar iniciando */ } };
    void poll(); const timer = window.setInterval(poll, 700);
    return () => { active = false; window.clearInterval(timer); };
  }, [busy]);

  const chooseClients = (list: FileList | null) => { const file = list?.[0] ?? null; setClientFile(file && supported.test(file.name) ? file : null); setResult(null); };
  const chooseIndicators = (list: FileList | File[]) => {
    const all = Array.from(list);
    const candidates = all.filter((file) => supported.test(file.name));
    const classified = classifyIndicatorFiles(candidates);
    setIndicatorFiles(classified.recognized);
    setIgnored([...classified.ignored.map((file) => file.name), ...all.filter((file) => !supported.test(file.name)).map((file) => file.name)]);
    setResult(null);
  };
  const syncClickUp = async () => {
    if (syncBusy || busy) return;
    setSyncBusy(true); setSyncError('');
    try {
      const response = await fetch(apiUrl('/api/clickup/sync'), { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.errors?.[0] ?? 'Não foi possível sincronizar com ClickUp.');
      const status = await fetch(apiUrl('/api/data/status')).then((value) => value.json());
      setCurrentStatus(status); setResult(payload); window.dispatchEvent(new Event('quarkrh:data-updated'));
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Falha ao sincronizar clientes.'); }
    finally { setSyncBusy(false); }
  };
  const send = async (path: string) => {
    if (!indicatorFiles.length || busy) return;
    if (path.endsWith('/process') && hasCurrentData && !window.confirm('Uma nova importação substituirá os dados atualmente processados. Deseja continuar?')) return;
    setBusy(true); setProgress({ stage: path.endsWith('/inspect') ? 'validando_estrutura' : 'enviando_arquivos' });
    const form = new FormData(); files.forEach((file) => form.append('files', file, file.name));
    const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 15 * 60 * 1000);
    try {
      const response = await fetch(apiUrl(path), { method: 'POST', body: form, signal: controller.signal });
      const payload = await response.json().catch(() => ({ status: 'erro', errors: [`Resposta inválida do serviço local (HTTP ${response.status}).`] }));
      if (!response.ok || payload.status === 'erro') { setResult({ ...payload, failedStage: stage }); setProgress((previous: any) => ({ ...previous, stage: 'erro' })); }
      else setResult(payload);
      if (response.ok && path.endsWith('/process') && payload.status === 'processado') { setProgress({ stage: 'concluido' }); window.dispatchEvent(new Event('quarkrh:data-updated')); }
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError' ? 'A importação excedeu 15 minutos.' : error instanceof Error ? error.message : 'Falha de rede no serviço local.';
      setResult({ status: 'erro', failedStage: stage, errors: [`Não foi possível concluir a importação: ${message}`] }); setProgress((previous: any) => ({ ...previous, stage: 'erro' }));
    } finally { window.clearTimeout(timeout); setBusy(false); }
  };
  const directoryProps = { webkitdirectory: '', directory: '', multiple: true } as React.InputHTMLAttributes<HTMLInputElement>;
  const currentStageIndex = stageIndex[progress?.stage] ?? 0;
  const stage = stages[currentStageIndex];
  const completed = result?.status === 'processado' && !busy;
  const progressPercent = completed ? 100 : Math.round(((currentStageIndex + 1) / stages.length) * 100);
  const progressStep = completed ? stages.length : currentStageIndex + 1;
  const failure = result?.errors?.[0];
  const failureMessage = typeof failure === 'string' ? failure : failure ? `${failure.filename ?? failure.file ?? 'Arquivo'}: ${failure.message ?? failure.issue ?? 'falha no processamento'}` : 'Verifique os arquivos e tente novamente.';
  const baseFile = currentStatus?.files?.find((file: any) => file.type === 'BASE_CLIENTES');
  const importedAt = formatProcessedDate(currentStatus?.processedAt, true) ?? '—';

  return <><AppSidebar onHome={() => { if (!busy) back(); }} onImport={() => {}} active="settings" collapsed={sidebarCollapsed} onToggle={onToggleSidebar}/><main><header className="topbar"><div className="brand"><div className="brand-mark">Q</div><div><strong>QuarkRH</strong><span>Monitoramento de Uso</span></div></div><div className="top-title"><strong>Importação de dados</strong><span>Base de clientes e indicadores</span></div></header><div className="content detail-content">
    <div className="page-heading"><div><p className="eyebrow">DADOS · PROCESSAMENTO LOCAL</p><h1>Importação de dados</h1><p>Sincronize a base de clientes pelo ClickUp e importe os arquivos de indicadores de uso.</p></div></div>{currentStatus?.status === 'processado' ? <section className="import-panel current-import"><strong>Base atualmente importada</strong><span>Arquivo: {baseFile?.filename ?? 'Não identificado'}</span><span>Última importação: {importedAt}</span><span>Clientes: {currentStatus.diagnostics?.clientCount ?? currentStatus.customers?.length ?? '—'}</span><span>Arquivos de indicadores: {currentStatus.diagnostics?.indicatorFilesProcessed ?? '—'}</span><span>Módulos identificados: {currentStatus.diagnostics?.modulesFound ?? '—'}</span></section> : <section className="import-panel">Nenhuma base importada.</section>}
    <div className="import-columns"><section className="import-panel clickup-panel"><div className="breakdown-head"><div><strong>BASE DE CLIENTES — CLICKUP</strong><span>Carteira sincronizada das listas Base de Clientes RH e CHURN</span></div><FileSpreadsheet size={19}/></div><div className="clickup-sync-summary"><span>Status da integração: <strong>{currentStatus?.clickupSync?.status ?? 'Não sincronizada'}</strong></span><span>Última sincronização: <strong>{formatProcessedDate(currentStatus?.clickupSync?.syncedAt, true) ?? '—'}</strong></span><span>Tasks Base de Clientes RH: <strong>{currentStatus?.clickupSync?.baseCustomerCount ?? '—'}</strong></span><span>Tasks CHURN: <strong>{currentStatus?.clickupSync?.churnCustomerCount ?? '—'}</strong></span><span>Clientes únicos: <strong>{currentStatus?.clickupSync?.consolidatedCustomerCount ?? '—'}</strong></span><span>Ativos: <strong>{currentStatus?.clickupSync?.activeCustomerCount ?? '—'}</strong></span><span>Somente CHURN: <strong>{currentStatus?.clickupSync?.churnOnlyCustomerCount ?? '—'}</strong></span><span>Nomes duplicados: <strong>{currentStatus?.clickupSync?.duplicateCount ?? '—'}</strong></span><span>Repetidos entre listas: <strong>{currentStatus?.clickupSync?.crossListDuplicateCount ?? 0}</strong></span></div><button className="primary-button" disabled={syncBusy || busy} onClick={() => void syncClickUp()}>{syncBusy ? <><LoaderCircle size={16} className="spin"/> Sincronizando clientes…</> : 'Sincronizar clientes'}</button>{syncError && <div className="import-message error" role="alert">{syncError}</div>}{currentStatus?.clickupSync?.sourceConflictCount > 0 && <div className="import-message warning">{currentStatus.clickupSync.sourceConflictCount} cliente(s) têm divergência cadastral entre listas; a Base de Clientes RH prevalece e o diagnóstico foi preservado.</div>}</section><section className="import-panel"><div className="breakdown-head"><div><strong>INDICADORES DE USO</strong><span>Múltiplos arquivos ou uma pasta completa</span></div><FolderOpen size={19}/></div><div className="import-actions"><label className="primary-button upload-button"><Upload size={16}/> Selecionar arquivos<input type="file" accept=".csv,.xlsx,.xls" multiple disabled={busy} onChange={(event) => chooseIndicators(Array.from(event.target.files ?? []))}/></label><label className="secondary-button upload-button"><FolderOpen size={16}/> Selecionar pasta<input type="file" accept=".csv,.xlsx,.xls" {...directoryProps} disabled={busy} onChange={(event) => chooseIndicators(Array.from(event.target.files ?? []))}/></label></div>{indicatorFiles.length > 0 && <div className="import-summary">{indicatorFiles.length} arquivo(s) de indicadores selecionado(s)</div>}{ignored.length > 0 && <div className="import-message warning">{ignored.length} arquivo(s) ignorado(s): {ignored.slice(0, 5).join(', ')}{ignored.length > 5 ? '…' : ''}</div>}</section></div>
    {files.length > 0 && <div className="import-panel"><div className="breakdown-head"><div><strong>Arquivos selecionados</strong><span>{files.length} arquivo(s) · prévia antes do processamento</span></div></div><div className="file-list">{files.map((file) => <div className="file-row" key={`${file.name}-${file.size}`}><span>{file.webkitRelativePath || file.name}</span><small>{Math.ceil(file.size / 1024)} KB</small></div>)}</div><div className="import-actions"><button className="secondary-button" disabled={busy || !indicatorFiles.length} onClick={() => send('/api/import/inspect')}>Validar lote</button><button className="primary-button" disabled={busy || indicatorFiles.length === 0} onClick={() => send('/api/import/process')}>{busy ? <><LoaderCircle size={16} className="spin"/> Processando dados…</> : 'Processar dados'}</button></div>{(busy || completed) && <div className="import-progress" role="status" aria-live="polite"><div className="import-progress-heading"><strong>{completed ? 'Importação concluída com sucesso.' : 'Processando dados'}</strong><span>{progressPercent}%</span></div><div className="import-progress-track" role="progressbar" aria-label="Progresso das etapas de importação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}><span style={{ width: `${progressPercent}%` }}/></div><div className="import-progress-step"><strong>{stage}</strong><span>Etapa {progressStep} de {stages.length} · progresso das etapas, não percentual de linhas</span></div></div>}</div>}
    {result && <div className="import-panel"><div className="breakdown-head"><div><strong>{result.status === 'processado' ? 'Importação concluída com sucesso.' : 'Resultado da validação'}</strong><span>{result.status}</span></div><span className="badge">{result.status === 'processado' ? 'SUCESSO' : result.errors?.length ? 'ERRO' : result.warnings?.length ? 'ALERTA' : 'PRONTO'}</span></div>{result.files?.map((file: any) => <div className="import-result" key={file.filename}><strong>{file.filename}</strong><span>{file.type} · {file.rowCount} linha(s) úteis · {file.confidence}</span><small>{file.reason}</small>{file.preview?.length > 0 && <small>Prévia: {JSON.stringify(file.preview[0])}</small>}</div>)}{result.summary && <div className="import-summary">Arquivos: {result.summary.totalFiles} · reconhecidos: {result.summary.recognizedFiles} · linhas: {result.summary.totalRows} · módulos: {result.diagnostics?.modulesFound ?? '—'}/18 · clientes: {result.diagnostics?.clientCount ?? result.diagnostics?.clientsInBase ?? '—'} · unidades: {result.diagnostics?.identifiedUnits ?? '—'} · com score: {result.diagnostics?.customersWithOverallScore ?? '—'} · indicadores sem regra: {result.diagnostics?.consolidation?.indicatorsWithoutRule ?? '—'} · indicadores não mapeados: {result.diagnostics?.indicatorsNotRecognized ?? '—'}</div>}{result.errors?.map((error: any, index: number) => <div className="import-message error" key={index}>{typeof error === 'string' ? error : `${error.filename ?? error.file ?? 'Arquivo'}: ${error.message ?? error.issue ?? 'Erro de processamento'}`}</div>)}{result.warnings?.map((warning: string, index: number) => <div className="import-message warning" key={index}>{warning}</div>)}</div>}
    {result?.status === 'erro' && <div className="import-message error" role="alert"><strong>Não foi possível concluir a importação.</strong><div>Etapa: {result.failedStage ?? 'validação ou processamento'}.</div><div>{failureMessage}</div><div>A base anterior permanece preservada.</div></div>}
    <div className="notice"><CircleHelp size={18}/><span>O lote só substitui os dados processados depois de validação e processamento concluídos. Em caso de falha, a importação anterior é preservada.</span></div>
  </div></main></>;
}
