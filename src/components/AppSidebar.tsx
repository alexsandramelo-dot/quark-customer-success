import { BarChart3, BellRing, ChevronDown, ChevronLeft, ChevronRight, LayoutDashboard, Settings, Upload } from 'lucide-react';
import { useState } from 'react';

type Props = {
  onHome: () => void;
  onDashboard?: () => void;
  onAlerts?: () => void;
  onImport: () => void;
  active?: 'home' | 'dashboard' | 'alerts' | 'settings';
  collapsed: boolean;
  onToggle: () => void;
};

export function AppSidebar({ onHome, onDashboard = () => {}, onAlerts = () => {}, onImport, active = 'home', collapsed, onToggle }: Props) {
  const [analysisOpen, setAnalysisOpen] = useState(active === 'dashboard' || active === 'alerts');
  const [settingsOpen, setSettingsOpen] = useState(active === 'settings');
  const analysisExpanded = analysisOpen || active === 'dashboard' || active === 'alerts';
  const settingsExpanded = settingsOpen || active === 'settings';
  return <aside className={`sidebar app-sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Navegação principal">
    <div className="sidebar-brand" aria-label="QuarkRH">Q</div>
    <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'} title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}>{collapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}</button>
    <button className={`side-link side-link-button ${active === 'home' ? 'active' : ''}`} onClick={onHome} title={collapsed ? 'Monitoramento de Uso' : undefined} aria-label="Monitoramento de Uso" aria-current={active === 'home' ? 'page' : undefined}><LayoutDashboard size={17}/><span className="sidebar-label">Monitoramento de Uso</span></button>
    <button className={`side-link side-link-button group-parent ${analysisExpanded ? 'active' : ''}`} aria-expanded={analysisExpanded} aria-controls="analysis-submenu" onClick={() => setAnalysisOpen((expanded) => !expanded)} title={collapsed ? 'Central de Análise' : undefined} aria-label="Central de Análise"><BarChart3 size={17}/><span className="sidebar-label">Central de Análise</span><ChevronDown className={analysisExpanded ? 'expanded' : ''} size={15}/></button>
    {analysisExpanded && <div id="analysis-submenu"><button className={`side-link side-link-button nested-link ${active === 'dashboard' ? 'active' : ''}`} aria-current={active === 'dashboard' ? 'page' : undefined} onClick={onDashboard} title={collapsed ? 'Dashboard' : undefined} aria-label="Dashboard"><BarChart3 size={17}/><span className="sidebar-label">Dashboard</span></button><button className={`side-link side-link-button nested-link ${active === 'alerts' ? 'active' : ''}`} aria-current={active === 'alerts' ? 'page' : undefined} onClick={onAlerts} title={collapsed ? 'Alertas' : undefined} aria-label="Alertas"><BellRing size={17}/><span className="sidebar-label">Alertas</span></button></div>}
    <button className={`side-link side-link-button group-parent ${settingsExpanded ? 'active' : ''}`} aria-expanded={settingsExpanded} aria-controls="settings-submenu" onClick={() => setSettingsOpen((expanded) => !expanded)} title={collapsed ? 'Configurações' : undefined} aria-label="Configurações"><Settings size={16}/><span className="sidebar-label">Configurações</span><ChevronDown className={settingsExpanded ? 'expanded' : ''} size={15}/></button>
    {settingsExpanded && <div id="settings-submenu"><button className={`side-link side-link-button nested-link ${active === 'settings' ? 'active' : ''}`} aria-current={active === 'settings' ? 'page' : undefined} onClick={onImport} title={collapsed ? 'Importar dados' : undefined} aria-label="Importar dados"><Upload size={16}/><span className="sidebar-label">Importar dados</span></button></div>}
  </aside>;
}
