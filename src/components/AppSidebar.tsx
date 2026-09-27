import { useState } from 'react';
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, LayoutDashboard, Settings, Upload } from 'lucide-react';

type Props = {
  onHome: () => void;
  onDashboard?: () => void;
  onImport: () => void;
  active?: 'home' | 'dashboard' | 'settings';
  collapsed: boolean;
  onToggle: () => void;
};

export function AppSidebar({ onHome, onDashboard = () => {}, onImport, active = 'home', collapsed, onToggle }: Props) {
  const [settingsExpanded, setSettingsExpanded] = useState(active === 'settings');
  const openSettings = () => {
    if (collapsed) { setSettingsExpanded(true); onToggle(); return; }
    setSettingsExpanded((expanded) => !expanded);
  };
  return <aside className={`sidebar app-sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Navegação principal">
    <div className="sidebar-brand" aria-label="QuarkRH">Q</div>
    <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'} title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}>{collapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}</button>
    <div className="side-section-label">MONITORAMENTO DE USO</div>
    <button className={`side-link side-link-button ${active === 'home' ? 'active' : ''}`} onClick={onHome} title={collapsed ? 'Monitoramento de Uso' : undefined} aria-label="Monitoramento de Uso"><LayoutDashboard size={17}/><span className="sidebar-label">Monitoramento de Uso</span></button>
    <button className={`side-link side-link-button ${active === 'dashboard' ? 'active' : ''}`} onClick={onDashboard} title={collapsed ? 'Dashboard' : undefined} aria-label="Dashboard"><BarChart3 size={17}/><span className="sidebar-label">Dashboard</span></button>
    <div className="side-section-label spaced">CONFIGURAÇÕES</div>
    <button className={`side-link side-link-button settings-parent ${active === 'settings' ? 'active' : ''}`} aria-expanded={settingsExpanded} aria-controls="settings-submenu" onClick={openSettings} title={collapsed ? 'Configurações' : undefined} aria-label="Configurações"><Settings size={17}/><span className="sidebar-label">Configurações</span>{!collapsed && <ChevronDown size={14} className={settingsExpanded ? 'expanded' : ''}/>}</button>
    {settingsExpanded && <div id="settings-submenu"><button className={`side-link side-link-button nested-link ${active === 'settings' ? 'active' : ''}`} aria-current={active === 'settings' ? 'page' : undefined} onClick={onImport} title={collapsed ? 'Importar dados' : undefined} aria-label="Importar dados"><Upload size={16}/><span className="sidebar-label">Importar dados</span></button></div>}
  </aside>;
}
