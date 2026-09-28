import { AppSidebar } from './AppSidebar';
import { HistoricalDashboardPrototype } from './HistoricalDashboardPrototype';

export function HistoricalAlertsPage({ onHome, onDashboard, onImport, sidebarCollapsed, onToggleSidebar }: {
  onHome: () => void; onDashboard: () => void; onImport: () => void; sidebarCollapsed: boolean; onToggleSidebar: () => void;
}) {
  return <><AppSidebar onHome={onHome} onDashboard={onDashboard} onAlerts={() => {}} onImport={onImport} active="alerts" collapsed={sidebarCollapsed} onToggle={onToggleSidebar}/><main><header className="topbar"><div className="brand"><div className="brand-mark">Q</div><div><strong>QuarkRH</strong><span>Monitoramento de Uso</span></div></div><div className="top-title"><div><strong>Alertas</strong><span>Acompanhamento de adoção · demonstrativo</span></div></div></header><div className="content analytics-content"><HistoricalDashboardPrototype mode="alerts" /></div></main></>;
}
