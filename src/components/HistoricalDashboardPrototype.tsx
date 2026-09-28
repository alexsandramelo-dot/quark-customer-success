import { useEffect, useState } from 'react';
import { ArrowDownRight, Check, MessageCircle, X } from 'lucide-react';
import {
  classifyHistoricalDrop,
  filterHistoricalAlerts,
  historicalAlertsMock,
  historicalPortfolioMock,
  largestAdoptionDropsMock,
  moduleUsageDropsMock,
  type HistoricalAlertFilter,
  type HistoricalAlertMock,
} from '../data/historicalDashboardMock';

const quickFilters: HistoricalAlertFilter[] = ['Todos', 'Estável', 'Em queda', 'Atenção', 'Crítico'];
const signedNumber = (value: number) => `−${Math.abs(value)} p.p.`;
const scoreText = (value: number) => `${value}%`;
const alertSlug = (classification: string) => classification.toLowerCase().replace('atenção', 'atencao').replace(/ /g, '-');

function HistoricalLineChart() {
  const chart = { left: 48, right: 570, top: 26, bottom: 202 };
  const xStep = (chart.right - chart.left) / (historicalPortfolioMock.length - 1);
  const y = (value: number) => chart.bottom - ((value - 60) / 20) * (chart.bottom - chart.top);
  const points = historicalPortfolioMock.map((point, index) => `${chart.left + xStep * index},${y(point.adoption)}`).join(' ');

  return <div className="historical-line-chart">
    <svg viewBox="0 0 610 255" role="img" aria-label="Evolução demonstrativa da adoção média da carteira: 72, 74, 75, 73, 70 e 68 por cento">
      {[60, 70, 80].map((value) => <g key={value}>
        <line x1={chart.left} x2={chart.right} y1={y(value)} y2={y(value)} className="history-grid-line" />
        <text x="4" y={y(value) + 4} className="history-axis-label">{value}%</text>
      </g>)}
      <polyline points={points} className="history-line" />
      {historicalPortfolioMock.map((point, index) => {
        const cx = chart.left + xStep * index;
        const cy = y(point.adoption);
        return <g key={point.label}>
          <circle cx={cx} cy={cy} r="5" className="history-point"><title>{point.label}: {point.adoption}% (dado demonstrativo)</title></circle>
          <text x={cx} y={cy - 12} textAnchor="middle" className="history-point-label">{point.adoption}%</text>
          <text x={cx} y="230" textAnchor="middle" className="history-axis-label">{point.label === 'Medição 1' ? 'Med. 1' : point.label === 'Medição 2' ? 'Med. 2' : point.label === 'Medição 3' ? 'Med. 3' : point.label === 'Medição 4' ? 'Med. 4' : point.label === 'Medição 5' ? 'Med. 5' : point.label}</text>
        </g>;
      })}
    </svg>
  </div>;
}

function AdoptionDropChart() {
  const maxDrop = Math.max(...largestAdoptionDropsMock.map((item) => item.dropPp));
  return <ol className="history-drop-list" aria-label="Clientes ordenados pela maior queda demonstrativa">
    {largestAdoptionDropsMock.map((item, index) => <li key={item.customerName}>
      <span className="history-drop-rank">{index + 1}</span>
      <span className="history-drop-name">{item.customerName}<i><b style={{ width: `${(item.dropPp / maxDrop) * 100}%` }} /></i></span>
      <strong>{signedNumber(-item.dropPp)}</strong>
    </li>)}
  </ol>;
}

function ModuleDropChart() {
  const maxDrop = Math.max(...moduleUsageDropsMock.map((item) => item.dropPp));
  return <ol className="history-module-list" aria-label="Módulos ordenados pela maior queda demonstrativa">
    {moduleUsageDropsMock.map((item) => <li key={item.moduleName}>
      <span>{item.moduleName}</span>
      <i><b style={{ width: `${(item.dropPp / maxDrop) * 100}%` }} /></i>
      <strong>{signedNumber(-item.dropPp)}</strong>
    </li>)}
  </ol>;
}

function AlertCard({ alert, selected, onSelect }: { alert: HistoricalAlertMock; selected: boolean; onSelect: () => void }) {
  const classification = classifyHistoricalDrop(alert.changePp);
  return <button type="button" className={`historical-alert-card alert-${alertSlug(classification)}${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onSelect}>
    <span className="historical-alert-card-top"><strong>{alert.customerName}</strong><span className={`historical-severity severity-${alertSlug(classification)}`}>{classification}</span></span>
    <span className="historical-alert-card-bottom"><span>Adoção <b>{scoreText(alert.currentAdoption)}</b></span><strong><ArrowDownRight size={16} aria-hidden="true" />{signedNumber(alert.changePp)}</strong></span>
  </button>;
}

function AlertDetails({ alert, onContact, onClose, sent }: { alert: HistoricalAlertMock; onContact: () => void; onClose: () => void; sent: boolean }) {
  const classification = classifyHistoricalDrop(alert.changePp);
  return <section className="historical-alert-details" aria-label={`Detalhes do alerta: ${alert.customerName}`}>
    <div className="historical-alert-details-heading">
      <div><p className="eyebrow">DETALHE DO ALERTA · MOCK</p><h3>{alert.customerName}</h3></div>
      <div className="historical-alert-detail-actions"><span className={`historical-severity severity-${alertSlug(classification)}`}>{classification}</span><button type="button" className="icon-button" aria-label="Fechar detalhes do cliente" onClick={onClose}><X size={18}/></button></div>
    </div>
    <div className="historical-alert-kpis">
      <div><span>Adoção atual</span><strong>{scoreText(alert.currentAdoption)}</strong></div>
      <div><span>Queda acumulada</span><strong className="historical-negative">{signedNumber(alert.changePp)}</strong></div>
      <div className="historical-readings"><span>Últimas medições</span><strong>{alert.readings.map(scoreText).join(' → ')}</strong></div>
    </div>
    <dl className="historical-contact-details">
      <div><dt>Jornada</dt><dd>{alert.journey}</dd></div>
      <div><dt>Data de assinatura</dt><dd>{alert.signedAt}</dd></div>
      <div><dt>Plano</dt><dd>{alert.plan}</dd></div>
      <div><dt>CSM</dt><dd>{alert.csm}</dd></div>
      <div><dt>Responsável</dt><dd>{alert.owner}</dd></div>
      <div><dt>E-mail</dt><dd>{alert.email}</dd></div>
      <div><dt>Telefone</dt><dd>{alert.phone}</dd></div>
    </dl>
    <div className="historical-alert-reason"><strong>Motivo do alerta</strong><p>“{alert.reason}”</p></div>
    <div className="historical-contact-actions">
      <button type="button" className="primary-button" onClick={onContact}><MessageCircle size={16} />Contactar cliente</button>
      {sent && <div className="historical-simulated-success" role="status"><strong>Simulação concluída — nenhum envio ou registro real foi feito.</strong><span><Check size={15} /> Mensagem enviada via WhatsApp oficial (simulado)</span><span><Check size={15} /> Acompanhamento registrado no ClickUp (simulado)</span></div>}
    </div>
  </section>;
}

export function HistoricalDashboardPrototype({ mode = 'analytics' }: { mode?: 'analytics' | 'alerts' }) {
  const [filter, setFilter] = useState<HistoricalAlertFilter>('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(() => mode === 'alerts' ? null : 'clinica-gama');
  const [contactOpen, setContactOpen] = useState(false);
  const [sentAlertId, setSentAlertId] = useState<string | null>(null);
  const visibleAlerts = filterHistoricalAlerts(filter);
  const counts = Object.fromEntries(quickFilters.map((option) => [option, filterHistoricalAlerts(option).length])) as Record<HistoricalAlertFilter, number>;
  const selectedAlert = selectedId ? historicalAlertsMock.find((alert) => alert.id === selectedId) ?? null : null;

  useEffect(() => {
    if (selectedId && !visibleAlerts.some((alert) => alert.id === selectedId)) setSelectedId(null);
  }, [filter, selectedId, visibleAlerts]);

  // Simulação exclusivamente local: confirmar não chama WhatsApp, ClickUp nem qualquer API.
  const simulateContact = () => {
    if (!selectedAlert) return;
    setSentAlertId(selectedAlert.id);
    setContactOpen(false);
  };

  return <section className={`historical-prototype ${mode === 'alerts' ? 'historical-alerts-page' : 'historical-analytics-page'}`} aria-label={mode === 'alerts' ? 'Alertas demonstrativos' : 'Protótipo de indicadores históricos demonstrativos'}>
    {mode === 'alerts' ? <div className="historical-prototype-heading"><div><p className="eyebrow">HOMOLOGAÇÃO DE LAYOUT</p><h2>Alertas de adoção</h2><p>Clientes que apresentaram variação na adoção e podem precisar de acompanhamento.</p></div><span className="historical-mock-badge">MOCK · DEMONSTRAÇÃO</span></div> : <div className="historical-prototype-heading"><div><p className="eyebrow">HOMOLOGAÇÃO DE LAYOUT</p><h2>Indicadores históricos</h2><p>Indicadores demonstrativos para validar a apresentação. Não são dados reais nem históricos da carteira.</p></div><span className="historical-mock-badge">MOCK · DEMONSTRAÇÃO</span></div>}
    {mode === 'alerts' ? <div className={`historical-alert-workspace${selectedAlert ? ' has-selection' : ''}`}><aside className="historical-alert-queue" aria-label="Fila demonstrativa de alertas">
      <div className="historical-alert-filters" role="group" aria-label="Filtrar alertas demonstrativos">{quickFilters.map((option) => <button type="button" key={option} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}<span className="historical-filter-count">{counts[option]}</span></button>)}</div>
      <div className="historical-alert-list">{visibleAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} selected={selectedAlert?.id === alert.id} onSelect={() => setSelectedId(alert.id)} />)}{visibleAlerts.length === 0 && <div className="filter-empty-state" role="status">Nenhum alerta nesta categoria.</div>}</div>
      <p className="historical-mock-caption">Contatos e variações são fictícios. Use os cards para visualizar o protótipo do detalhe.</p>
    </aside>{selectedAlert && <AlertDetails alert={selectedAlert} onClose={() => setSelectedId(null)} onContact={() => { setSentAlertId(null); setContactOpen(true); }} sent={sentAlertId === selectedAlert.id} />}</div> : <div className="historical-prototype-main">
        <section className="analytics-card historical-trend-card"><div className="analytics-card-heading"><div><h2>Evolução da adoção da carteira</h2><p>Adoção média · medições demonstrativas</p></div><span className="historical-chart-unit">%</span></div><HistoricalLineChart /></section>
        <div className="historical-comparison-grid">
          <section className="analytics-card historical-comparison-card"><div className="analytics-card-heading"><div><h2>Clientes com maior queda</h2><p>Redução acumulada · pontos percentuais</p></div></div><AdoptionDropChart /></section>
          <section className="analytics-card historical-comparison-card"><div className="analytics-card-heading"><div><h2>Queda de uso por módulo</h2><p>Variação demonstrativa · pontos percentuais</p></div></div><ModuleDropChart /></section>
        </div>
      </div>}

    {contactOpen && selectedAlert && <div className="historical-contact-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setContactOpen(false); }}><section className="historical-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="historical-contact-title"><div className="historical-contact-dialog-heading"><div><p className="eyebrow">PRÉVIA DE MENSAGEM · MOCK</p><h3 id="historical-contact-title">Contactar {selectedAlert.customerName}</h3></div><button type="button" className="icon-button" aria-label="Fechar prévia" onClick={() => setContactOpen(false)}><X size={18} /></button></div><p className="historical-preview-warning">Simulação visual: nenhuma API de WhatsApp será chamada e nenhum comentário será criado no ClickUp.</p><div className="historical-message-preview">Olá, {selectedAlert.owner}!<br /><br />Identificamos uma mudança recente na utilização do QuarkRH e gostaríamos de acompanhar como está sendo a experiência da sua empresa.<br /><br />Podemos conversar?</div><div className="historical-contact-dialog-actions"><button type="button" className="secondary-button" onClick={() => setContactOpen(false)}>Cancelar</button><button type="button" className="primary-button" onClick={simulateContact}>Enviar WhatsApp</button></div></section></div>}
  </section>;
}
