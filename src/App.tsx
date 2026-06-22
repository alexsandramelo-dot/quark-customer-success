/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { AtividadeCSV, VariavelCSV, Cliente } from "./types";
import { 
  DEFAULT_ATIVIDADES, 
  DEFAULT_VARIAVEIS, 
  calcularMétricasEHealthScore, 
  REFERENCE_DATE,
  parseCSVAtividades,
  parseCSVVariaveis,
  gerarTemplateCSVAtividades,
  gerarTemplateCSVVariaveis
} from "./data";
import ExecutiveDashboard from "./components/ExecutiveDashboard";
import ClientsInRisk from "./components/ClientsInRisk";
import AlertsCenter from "./components/AlertsCenter";
import ClientDetails from "./components/ClientDetails";
import VariableAnalysis from "./components/VariableAnalysis";
import SettingsConfig from "./components/SettingsConfig";

import { 
  BarChart4, 
  Users, 
  Bell, 
  PieChart, 
  Sliders, 
  Search, 
  Calendar, 
  LogOut, 
  HelpCircle,
  Menu,
  X,
  PlusCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Loader2,
  CloudOff,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Download
} from "lucide-react";

const URL_ATIVIDADES = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSMh99jhArJdw6BnE55fjmp87zdxW-VURfhbUYXbKmD5mja9DlcHqDO4Ir4E8s4P2C2tEQ4PZmrt3cM/pub?output=csv";
const URL_VARIAVEIS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRC16StwXjAuc6JWvnw4VdXyTr-9YVJd11819TQ45AWdcqmITm43OptmfOHx6jfKib1ZUiqZB_CYLSa/pub?output=csv";

export default function App() {
  // State for raw tables
  const [atividades, setAtividades] = useState<AtividadeCSV[]>(DEFAULT_ATIVIDADES);
  const [variaveis, setVariaveis] = useState<VariavelCSV[]>(DEFAULT_VARIAVEIS);

  // Sync state for Google Sheets
  const [loadingStatus, setLoadingStatus] = useState<"loading" | "success" | "error" | "offline-cache" | "idle">("idle");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Router layout states
  // "Geral" = Executive Dashboard, "Clientes" = Portfolio, "Alertas" = Alarms, "Variáveis" = Technical Analysis, "Configurações" = Settings, "ClienteProfile" = Detail
  const [selectedView, setSelectedView] = useState<string>("Geral");
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  // Global filters synchronized across dashboards
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("Geral");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Resolving tracking state for alarms
  const [resolvedIndicators, setResolvedIndicators] = useState<string[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  
  // Mobile sidebar menu toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fast direct local spreadsheet load state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedAtividades, setUploadedAtividades] = useState<AtividadeCSV[] | null>(null);
  const [uploadedVariaveis, setUploadedVariaveis] = useState<VariavelCSV[] | null>(null);
  const [ativFileName, setAtivFileName] = useState<string | null>(null);
  const [varFileName, setVarFileName] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Fetch Google Sheets and cache values
  const carregarDadosSheets = async (isManual = false) => {
    setLoadingStatus("loading");
    setErrorMessage(null);
    if (isManual) {
      triggerGlobalNotification("Buscando atualizações de dados no Google Sheets...");
    }

    try {
      const [resAtiv, resVar] = await Promise.all([
        fetch(URL_ATIVIDADES),
        fetch(URL_VARIAVEIS)
      ]);

      if (!resAtiv.ok || !resVar.ok) {
        throw new Error(`Resposta HTTP inválida (Atividades: ${resAtiv.status}, Variáveis: ${resVar.status})`);
      }

      const textAtiv = await resAtiv.text();
      const textVar = await resVar.text();

      if (textAtiv.includes("<!DOCTYPE html>") || textVar.includes("<!DOCTYPE html>")) {
        throw new Error("As planilhas retornaram HTML ao invés de CSV legítimo (verifique se foram publicadas como CSV).");
      }

      const parsedAtividades = parseCSVAtividades(textAtiv);
      const parsedVariaveis = parseCSVVariaveis(textVar);

      if (parsedAtividades.length === 0 || parsedVariaveis.length === 0) {
        throw new Error("Tabelas CSV vazias ou sem headers correspondentes.");
      }

      setAtividades(parsedAtividades);
      setVariaveis(parsedVariaveis);

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      const timestamp = `${dateStr} às ${timeStr}`;

      // Save to localStorage for robust caching inside a nested try-catch to prevent QuotaExceededError from crashing the sync
      try {
        localStorage.setItem("quark_csv_atividades", textAtiv);
        localStorage.setItem("quark_csv_variaveis", textVar);
        localStorage.setItem("quark_csv_timestamp", timestamp);
      } catch (cacheErr: any) {
        console.error("Falhas de cache ao tentar gravar dados locais:", cacheErr);
      }

      setLastUpdate(timestamp);
      setLoadingStatus("success");
      triggerGlobalNotification(`Dados atualizados! ${parsedVariaveis.length} clientes e ${parsedAtividades.length} atividades de uso carregados.`);

    } catch (err: any) {
      console.error("Falha ao sincronizar com Google Sheets:", err);
      const errorMsg = err?.message || "Sem conexão de internet ou bloqueio CORS.";
      setErrorMessage(errorMsg);

      // Attempt to load from localStorage cache
      let cachedAtiv = null;
      let cachedVar = null;
      let cachedTime = null;
      try {
        cachedAtiv = localStorage.getItem("quark_csv_atividades");
        cachedVar = localStorage.getItem("quark_csv_variaveis");
        cachedTime = localStorage.getItem("quark_csv_timestamp");
      } catch (cacheGetErr: any) {
        console.error("Falhas de cache ao tentar recuperar itens do localStorage:", cacheGetErr);
      }

      if (cachedAtiv && cachedVar) {
        try {
          const parsedAtividades = parseCSVAtividades(cachedAtiv);
          const parsedVariaveis = parseCSVVariaveis(cachedVar);

          if (parsedAtividades.length > 0 && parsedVariaveis.length > 0) {
            setAtividades(parsedAtividades);
            setVariaveis(parsedVariaveis);
            setLastUpdate(cachedTime);
            setLoadingStatus("offline-cache");
            triggerGlobalNotification("Planilha inacessível. Exibindo dados locais do cache.");
            return;
          }
        } catch (e: any) {
          console.error("Falhas de cache (erro ao fazer parse do cache local):", e);
        }
      } else {
        console.error("Falhas de cache: nenhum dado em cache encontrado no localStorage.");
      }

      // No cache
      setLoadingStatus("error");
      setAtividades(DEFAULT_ATIVIDADES);
      setVariaveis(DEFAULT_VARIAVEIS);
      triggerGlobalNotification("Falha na sincronização. Exibindo dados integrados de demonstração.");
    }
  };

  // Auto trigger instant load from local Cache OR optimized demo dataset
  useEffect(() => {
    let cachedAtiv = null;
    let cachedVar = null;
    let cachedTime = null;
    try {
      cachedAtiv = localStorage.getItem("quark_csv_atividades");
      cachedVar = localStorage.getItem("quark_csv_variaveis");
      cachedTime = localStorage.getItem("quark_csv_timestamp");
    } catch (cacheGetErr: any) {
      console.error("Falhas de cache ao carregar inicial do localStorage:", cacheGetErr);
    }

    if (cachedAtiv && cachedVar) {
      try {
        const parsedAtividades = parseCSVAtividades(cachedAtiv);
        const parsedVariaveis = parseCSVVariaveis(cachedVar);

        if (parsedAtividades.length > 0 && parsedVariaveis.length > 0) {
          setAtividades(parsedAtividades);
          setVariaveis(parsedVariaveis);
          setLastUpdate(cachedTime);
          setLoadingStatus("offline-cache");
          return;
        }
      } catch (e: any) {
        console.error("Erro parsing cache inicial:", e);
      }
    }

    // Default to idle state with our demo data instantly (blazing fast load)
    try {
      setAtividades(DEFAULT_ATIVIDADES);
      setVariaveis(DEFAULT_VARIAVEIS);
      setLastUpdate("Original");
      setLoadingStatus("idle");
    } catch (err) {
      console.error("Falha ao carregar demo inicial:", err);
    }
  }, []);

  // Compute calculated clients list dynamically on state updates
  const listClientesCalculated = useMemo(() => {
    try {
      const computed = calcularMétricasEHealthScore(atividades, variaveis);
      
      // Apply resolved status tags from our interactive tracker
      return computed.map((c) => {
        const activeAlertsWithResolution = (c?.alertas_ativos || []).map((a) => {
          const key = `${c.id}-${a.tipo}`;
          return {
            ...a,
            resolvido: resolvedIndicators.includes(key)
          };
        });

        // Filter out resolved from calculation counts or retain with property
        const unresolvedAlertsOnly = activeAlertsWithResolution.filter(a => !a.resolvido);

        return {
          ...c,
          alertas_ativos: unresolvedAlertsOnly
        };
      });
    } catch (computeErr: any) {
      console.error("Falha nos cálculos do dashboard: erro de mapeamento de métricas:", computeErr);
      return [];
    }
  }, [atividades, variaveis, resolvedIndicators]);

  // Alert Badge calculation for sidebar item
  const unhandledAlertsCount = useMemo(() => {
    return listClientesCalculated.reduce((sum, c) => sum + c.alertas_ativos.length, 0);
  }, [listClientesCalculated]);

  // Direct CSV Local upload state helpers
  const [rawAtividadesText, setRawAtividadesText] = useState<string | null>(null);
  const [rawVariaveisText, setRawVariaveisText] = useState<string | null>(null);

  const parseAtividadesFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSVAtividades(text);
        if (parsed.length === 0) {
          setModalError("Arquivo de atividades vazio ou em formato incompatível.");
          return;
        }
        setUploadedAtividades(parsed);
        setRawAtividadesText(text);
        setAtivFileName(file.name);
        setModalError(null);
      } catch (err) {
        setModalError("Erro ao processar arquivo de atividades.");
      }
    };
    reader.readAsText(file);
  };

  const parseVariaveisFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSVVariaveis(text);
        if (parsed.length === 0) {
          setModalError("Arquivo de variáveis vazio ou em formato incompatível.");
          return;
        }
        setUploadedVariaveis(parsed);
        setRawVariaveisText(text);
        setVarFileName(file.name);
        setModalError(null);
      } catch (err) {
        setModalError("Erro ao processar arquivo de variáveis.");
      }
    };
    reader.readAsText(file);
  };

  const handleApplyUploadedFiles = () => {
    if (!uploadedAtividades && !uploadedVariaveis) {
      setModalError("Por favor, selecione pelo menos uma planilha para carregar.");
      return;
    }
    
    if (uploadedAtividades && rawAtividadesText) {
      setAtividades(uploadedAtividades);
      try { localStorage.setItem("quark_csv_atividades", rawAtividadesText); } catch(e){}
    }
    if (uploadedVariaveis && rawVariaveisText) {
      setVariaveis(uploadedVariaveis);
      try { localStorage.setItem("quark_csv_variaveis", rawVariaveisText); } catch(e){}
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestamp = `${now.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} às ${timeStr}`;
    setLastUpdate(timestamp);
    setLoadingStatus("offline-cache");
    try { localStorage.setItem("quark_csv_timestamp", timestamp); } catch(e){}

    triggerGlobalNotification("Planilhas CSV carregadas e métricas de CS recalculadas instantaneamente!");
    
    // Reset state values
    setUploadedAtividades(null);
    setUploadedVariaveis(null);
    setRawAtividadesText(null);
    setRawVariaveisText(null);
    setAtivFileName(null);
    setVarFileName(null);
    setShowUploadModal(false);
  };

  const handleDownloadTemplateFile = (type: "atividades" | "variaveis") => {
    const text = type === "atividades" ? gerarTemplateCSVAtividades() : gerarTemplateCSVVariaveis();
    const filename = type === "atividades" ? "atividades.csv" : "variaveis.csv";
    
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Operations
  const handleImportAtividades = (data: AtividadeCSV[]) => {
    setAtividades(data);
    triggerGlobalNotification(`Sincronizadas ${data.length} novas atividades de uso de QuarkRH & QuarkClinic.`);
  };

  const handleImportVariaveis = (data: VariavelCSV[]) => {
    setVariaveis(data);
    triggerGlobalNotification(`Registrados ${data.length} de contas comerciais contratadas com MRR.`);
  };

  const handleResetDatabase = () => {
    setAtividades(DEFAULT_ATIVIDADES);
    setVariaveis(DEFAULT_VARIAVEIS);
    setResolvedIndicators([]);
    triggerGlobalNotification("Base de dados restaurada para os protótipos padrões do sistema QUARK.");
  };

  const handleAddClientManual = (newV: VariavelCSV, initialA: AtividadeCSV) => {
    setVariaveis((prev) => [newV, ...prev]);
    setAtividades((prev) => [initialA, ...prev]);
    triggerGlobalNotification(`Nova conta "${newV.nome_cliente}" engajada com sucesso!`);
  };

  const handleResolveAlert = (clientId: string, alertType: string) => {
    const key = `${clientId}-${alertType}`;
    setResolvedIndicators((prev) => [...prev, key]);
    triggerGlobalNotification("Alerta sinalizado como resolvido pelo profissional de CS!");
  };

  const triggerGlobalNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Safe view helper for list navigations
  const handleNavigate = (view: string, clientId?: string) => {
    setSelectedView(view);
    if (clientId) {
      setActiveClientId(clientId);
    }
    setMobileMenuOpen(false); // Auto close mobile rails
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex" id="quark-cs-workspace">
      {/* Dynamic persistent alert toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-slide-in">
          <CheckCircle className="text-emerald-400 w-5 h-5 flex-shrink-0" />
          <span className="text-xs font-bold font-sans tracking-wide leading-relaxed">{notification}</span>
        </div>
      )}

      {/* PERSISTENT LEFT SIDEBAR - Desktop Mode */}
      <aside className="hidden lg:flex w-64 bg-slate-950 text-slate-200 flex-col justify-between border-r border-slate-800 p-6 flex-shrink-0">
        <div>
          {/* Logo badge */}
          <div className="flex items-center gap-3 mb-10 pb-4 border-b border-slate-900">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-emerald-400 to-indigo-500 flex items-center justify-center font-black text-white text-base">
              Q
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-widest text-white block">QUARK</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Customer Success</span>
            </div>
          </div>

          {/* Navigation link stacks */}
          <nav className="space-y-1.5">
            <button
              onClick={() => handleNavigate("Geral")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-xs font-bold transition-all text-left group ${
                selectedView === "Geral" 
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <BarChart4 className="w-4 h-4 flex-shrink-0" />
              <span>Dashboard Executivo</span>
            </button>

            <button
              onClick={() => handleNavigate("Clientes")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-xs font-bold transition-all text-left group ${
                selectedView === "Clientes" || selectedView === "ClienteProfile"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>Gestão de Carteira</span>
            </button>

            <button
              onClick={() => handleNavigate("Alertas")}
              className={`w-full flex justify-between items-center px-4 py-3 rounded-lg text-xs font-bold transition-all text-left group ${
                selectedView === "Alertas" 
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <Bell className="w-4 h-4 flex-shrink-0" />
                <span>Central de Alertas</span>
              </div>
              {unhandledAlertsCount > 0 && (
                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${selectedView === "Alertas" ? "bg-slate-950 text-emerald-400" : "bg-rose-500 text-white"}`}>
                  {unhandledAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleNavigate("Variáveis")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-xs font-bold transition-all text-left group ${
                selectedView === "Variáveis" 
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <PieChart className="w-4 h-4 flex-shrink-0" />
              <span>Análise de Variáveis</span>
            </button>

            <button
              onClick={() => handleNavigate("Configurações")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-xs font-bold transition-all text-left group ${
                selectedView === "Configurações" 
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Sliders className="w-4 h-4 flex-shrink-0" />
              <span>Configurações & CSV</span>
            </button>
          </nav>
        </div>

        {/* Persistent Workspace Operator block */}
        <div className="border-t border-slate-900 pt-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-extrabold text-white text-xs">
              RS
            </div>
            <div>
              <p className="text-xs font-black text-white">Ricardo Silva</p>
              <p className="text-[10px] text-slate-400 font-bold">Head of Success</p>
            </div>
          </div>
          <button 
            onClick={() => triggerGlobalNotification("Simulador de logout concluído: sessão persistente preservada.")}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* MOBILE BAR HEADER & DRAWER SYSTEM */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="bg-slate-950 text-white lg:hidden h-14 px-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-400 text-slate-950 flex items-center justify-center font-black text-xs">
              Q
            </div>
            <span className="font-extrabold text-xs tracking-wider">QUARK CS</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleNavigate("Alertas")}
              className="relative p-1 text-slate-400 hover:text-white"
            >
              <Bell className="w-5 h-5" />
              {unhandledAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold">
                  {unhandledAlertsCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile menu panel dropdown */}
        {mobileMenuOpen && (
          <div className="bg-slate-900 border-b border-slate-800 lg:hidden p-4 space-y-2 animate-fade-in text-slate-200">
            <button 
              onClick={() => handleNavigate("Geral")}
              className="w-full text-left font-bold text-xs p-2.5 rounded hover:bg-slate-800 flex items-center gap-3"
            >
              <BarChart4 className="w-4 h-4" />
              Dashboard Executivo
            </button>
            <button 
              onClick={() => handleNavigate("Clientes")}
              className="w-full text-left font-bold text-xs p-2.5 rounded hover:bg-slate-800 flex items-center gap-3"
            >
              <Users className="w-4 h-4" />
              Gestão de Carteira
            </button>
            <button 
              onClick={() => handleNavigate("Alertas")}
              className="w-full text-left font-bold text-xs p-2.5 rounded hover:bg-slate-800 flex items-center justify-between"
            >
              <span className="flex items-center gap-3">
                <Bell className="w-4 h-4" />
                Central de Alertas
              </span>
              {unhandledAlertsCount > 0 && (
                <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[9px] font-bold">
                  {unhandledAlertsCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => handleNavigate("Variáveis")}
              className="w-full text-left font-bold text-xs p-2.5 rounded hover:bg-slate-800 flex items-center gap-3"
            >
              <PieChart className="w-4 h-4" />
              Análise de Variáveis
            </button>
            <button 
              onClick={() => handleNavigate("Configurações")}
              className="w-full text-left font-bold text-xs p-2.5 rounded hover:bg-slate-800 flex items-center gap-3"
            >
              <Sliders className="w-4 h-4" />
              Configurações & Importação
            </button>
          </div>
        )}

        {/* SYSTEM APP BAR HEADER - Top navigation metadata */}
        <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
          {/* Internal search filter bar focused on customer search synchronization */}
          <div className="relative w-full max-w-sm">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input 
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar cliente, número de contrato ou métrica..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-500/80 focus:border-emerald-500/80 transition-all shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3.5 justify-end font-semibold">
            {/* Direct Instant CSV Load Button */}
            <button
              onClick={() => {
                setModalError(null);
                setShowUploadModal(true);
              }}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 rounded-lg text-xs font-black flex items-center gap-2 transition-all shadow-md font-sans border border-emerald-400/30"
              title="Carregar planilhas de Atividades ou Clientes diretamente do seu computador"
            >
              <UploadCloud className="w-4 h-4 text-slate-950" />
              <span>Carregar Planilhas CSV</span>
            </button>

            {/* Google Sheets Sync Controller Dashboard Block */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-200/60 shadow-sm">
              {loadingStatus === "loading" ? (
                <button
                  disabled
                  className="px-3 py-1.5 bg-slate-200 text-slate-500 rounded-md text-xs font-bold flex items-center gap-2 font-sans cursor-not-allowed select-none"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  <span>Sincronizando...</span>
                </button>
              ) : (
                <button
                  onClick={() => carregarDadosSheets(true)}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-white rounded-md text-xs font-bold flex items-center gap-2 font-sans transition-all active:scale-95 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar Dados</span>
                </button>
              )}
              
              <div className="pr-3 pl-1 flex flex-col justify-center leading-none">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    loadingStatus === "success" ? "bg-emerald-500 animate-pulse" :
                    loadingStatus === "loading" ? "bg-indigo-500 animate-bounce" :
                    loadingStatus === "offline-cache" ? "bg-amber-500" :
                    "bg-rose-500"
                  }`} />
                  <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest leading-none">
                    {loadingStatus === "success" ? "Publicado" :
                     loadingStatus === "loading" ? "Carregando" :
                     loadingStatus === "offline-cache" ? "Offline" :
                     "Demonstração"}
                  </span>
                </div>
                {lastUpdate && (
                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5 whitespace-nowrap">
                    {lastUpdate}
                  </span>
                )}
              </div>
            </div>

            {/* Clock helper referencing user local anchor 2026-06-16 */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200/60 text-slate-600 text-xs shadow-sm">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-mono text-[11px] tracking-wide">16 Jun, 2026</span>
            </div>
            
            <div className="hidden sm:flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900 transition-colors">
              <HelpCircle className="w-4 h-4" />
              <span className="text-xs font-sans">Ajuda</span>
            </div>
          </div>
        </div>

        {/* SCROLLABLE DESKTOP WORKING AREA VIEW CONTAINER */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {/* Friendly Google Sheets Sync Processing Loading Banners */}
          {loadingStatus === "loading" && (
            <div className="mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest leading-none">Sincronizando Dados em Tempo Real</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
                    Buscando e reinterpretando registros de atividades de uso e contratos comerciais do Google Sheets...
                  </p>
                </div>
              </div>
              <span className="text-[9px] text-emerald-400 font-bold font-mono uppercase bg-slate-950 px-2 py-1 rounded border border-slate-800">Quark Sync Engine</span>
            </div>
          )}

          {/* Friendly Google Sheets Sync Failure/Warning Message Banners */}
          {loadingStatus === "error" && (
            <div className="mb-6 bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-r-xl p-4 shadow-sm animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-3 items-start">
                <AlertTriangle className="text-red-500 w-5 h-5 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="text-xs font-black text-red-950 uppercase tracking-widest">Falha de Sincronização em Tempo Real</h4>
                  <p className="text-xs text-red-700 mt-1 leading-relaxed font-sans">
                    Não conseguimos conectar com o Google Sheets ({errorMessage || "Conexão de rede rejeitada"}). 
                    Exibindo os dados integrados locais padrão para garantir que nenhuma análise pare.
                  </p>
                </div>
              </div>
              <button
                onClick={() => carregarDadosSheets(true)}
                className="self-start md:self-center px-4 py-2 bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 font-bold" />
                <span>Atualizar Dados</span>
              </button>
            </div>
          )}

          {loadingStatus === "offline-cache" && (
            <div className="mb-6 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-r-xl p-4 shadow-sm animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-3 items-start">
                <CloudOff className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-widest">Conexão Reduzida — Exibindo Cache</h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed font-sans">
                    A leitura do Google Sheets falhou. Para garantir o desempenho, carregamos o cache de dados guardado localmente em <strong className="font-extrabold text-amber-900">{lastUpdate || "Sessão Anterior"}</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => carregarDadosSheets(true)}
                className="self-start md:self-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 font-bold" />
                <span>Sincronizar Novamente</span>
              </button>
            </div>
          )}
          {selectedView === "Geral" && (
            <ExecutiveDashboard 
              clientes={listClientesCalculated} 
              onNavigate={handleNavigate}
              selectedProduct={selectedProductFilter}
              setSelectedProduct={setSelectedProductFilter}
            />
          )}

          {selectedView === "Clientes" && (
            <ClientsInRisk 
              clientes={listClientesCalculated} 
              onNavigate={handleNavigate}
              onAddClient={() => handleNavigate("Configurações")}
              onExportList={() => triggerGlobalNotification("Lista de clientes e scores de churn exportada com sucesso!")}
              selectedProduct={selectedProductFilter}
              setSelectedProduct={setSelectedProductFilter}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
            />
          )}

          {selectedView === "Alertas" && (
            <AlertsCenter 
              clientes={listClientesCalculated} 
              onNavigate={handleNavigate}
              onRefreshBase={() => triggerGlobalNotification("Monitor de atividades executando varreduras... Todos as médias de saúde atualizadas!")}
              onResolveAlert={handleResolveAlert}
            />
          )}

          {selectedView === "Variáveis" && (
            <VariableAnalysis 
              clientes={listClientesCalculated} 
              onNavigate={handleNavigate}
            />
          )}

          {selectedView === "ClienteProfile" && (
            <ClientDetails 
              clientes={listClientesCalculated} 
              clienteId={activeClientId} 
              onNavigate={handleNavigate}
              onEditClient={(id) => handleNavigate("Configurações")}
            />
          )}

          {selectedView === "Configurações" && (
            <SettingsConfig 
              onImportAtividades={handleImportAtividades}
              onImportVariaveis={handleImportVariaveis}
              onResetDatabase={handleResetDatabase}
              onAddClientManual={handleAddClientManual}
            />
          )}
        </main>
      </div>

      {/* CSV Spreadsheet Uploader Premium Modal Panel */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-800 max-w-xl w-full flex flex-col overflow-hidden animate-fade-in font-sans">
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm tracking-wide uppercase">Carregar Planilhas de CS</h3>
              </div>
              <button 
                onClick={() => {
                  setUploadedAtividades(null);
                  setUploadedVariaveis(null);
                  setAtivFileName(null);
                  setVarFileName(null);
                  setShowUploadModal(false);
                }}
                className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors"
                id="close-upload-modal-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
              <p className="text-xs text-slate-600 leading-relaxed">
                Adicione suas planilhas para calcular scores de saúde em tempo real de forma offline e imediata, evitando lentidão de conexões com o Google Sheets:
              </p>

              {modalError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Input block - Atividades */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    1. Planilha de Atividades (.csv)
                  </label>
                  <button 
                    onClick={() => handleDownloadTemplateFile("atividades")}
                    className="text-[10px] text-indigo-650 hover:text-indigo-800 font-extrabold flex items-center gap-1 hover:underline"
                    id="download-atividades-template-btn"
                  >
                    <Download className="w-3 h-3" />
                    Baixar Modelo
                  </button>
                </div>
                <div className="border border-slate-200/80 rounded-lg p-3 bg-slate-50 flex items-center justify-between shadow-xs">
                  <input
                    id="atividades-file-input"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        parseAtividadesFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="atividades-file-input"
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
                    id="select-atividades-file-label"
                  >
                    Selecionar Arquivo
                  </label>
                  <span className="text-xs text-slate-500 truncate max-w-[240px] pl-2 font-semibold">
                    {ativFileName ? `✓ ${ativFileName} (${uploadedAtividades?.length || 0} linhas)` : "Nenhum arquivo selecionado"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Colunas requeridas: cliente_id, produto, data, requisicoes, usuarios_ativos, usuarios_totais.
                </p>
              </div>

              {/* Input block - Clientes / Variáveis */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    2. Planilha de Clientes & Contas (.csv)
                  </label>
                  <button 
                    onClick={() => handleDownloadTemplateFile("variaveis")}
                    className="text-[10px] text-indigo-650 hover:text-indigo-800 font-extrabold flex items-center gap-1 hover:underline"
                    id="download-variaveis-template-btn"
                  >
                    <Download className="w-3 h-3" />
                    Baixar Modelo
                  </button>
                </div>
                <div className="border border-slate-200/80 rounded-lg p-3 bg-slate-50 flex items-center justify-between shadow-xs">
                  <input
                    id="variaveis-file-input"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        parseVariaveisFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="variaveis-file-input"
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
                    id="select-variaveis-file-label"
                  >
                    Selecionar Arquivo
                  </label>
                  <span className="text-xs text-slate-500 truncate max-w-[240px] pl-2 font-semibold">
                    {varFileName ? `✓ ${varFileName} (${uploadedVariaveis?.length || 0} registros)` : "Nenhum arquivo selecionado"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Colunas requeridas: id, nome_cliente, mrr, plano, total_variaveis.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shadow-inner">
              <button
                onClick={() => {
                  setUploadedAtividades(null);
                  setUploadedVariaveis(null);
                  setAtivFileName(null);
                  setVarFileName(null);
                  setShowUploadModal(false);
                }}
                className="px-4 py-2 hover:bg-slate-100 text-slate-600 rounded text-xs font-bold transition-all"
                id="cancel-upload-btn"
              >
                Voltar à Análise
              </button>
              <button
                onClick={handleApplyUploadedFiles}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 font-black text-slate-950 rounded text-xs transition-all shadow active:scale-95 flex items-center gap-1.5"
                id="apply-upload-btn"
              >
                <CheckCircle className="w-4 h-4" />
                Aplicar e Recalcular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

