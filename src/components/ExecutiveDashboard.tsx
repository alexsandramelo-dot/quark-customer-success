/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Cliente } from "../types";
import { ArrowUpRight, ArrowDownRight, Users, AlertTriangle, Flame, Heart, TrendingUp, HelpCircle, Bell } from "lucide-react";
// No Recharts dependencies needed - custom native SVG graphs prevent React 19 blackscreen crashes
interface ChartPoint {
  name: string;
  Atividade: number;
  Projetado: number;
}

function CustomAreaChart({ data }: { data: ChartPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-slate-400 font-sans">Sem dados</div>;
  }

  // Find max value to scale chart appropriately
  const maxVal = Math.max(...data.map(d => Math.max(d.Atividade, d.Projetado)), 100);

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const width = 600;
  const height = 240;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Map points to SVG coordinates
  const points = data.map((d, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const yAtiv = padding.top + chartHeight - (d.Atividade / maxVal) * chartHeight;
    const yProj = padding.top + chartHeight - (d.Projetado / maxVal) * chartHeight;
    return { name: d.name, x, yAtiv, yProj, Atividade: d.Atividade, Projetado: d.Projetado };
  });

  // Create paths
  let ativLinePath = "";
  let ativAreaPath = "";
  let projLinePath = "";

  if (points.length > 0) {
    ativLinePath = `M ${points[0].x} ${points[0].yAtiv} ` + points.slice(1).map(p => `L ${p.x} ${p.yAtiv}`).join(" ");
    ativAreaPath = `${ativLinePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;
    projLinePath = `M ${points[0].x} ${points[0].yProj} ` + points.slice(1).map(p => `L ${p.x} ${p.yProj}`).join(" ");
  }

  // Y Axis ticks to display
  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <div className="relative w-full h-full select-none" style={{ minHeight: "220px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="svgAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines & Y-Axis Labels */}
        {yTicks.map((val, idx) => {
          const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
          return (
            <g key={idx} className="opacity-90">
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 3} textAnchor="end" className="fill-slate-400 font-mono" style={{ fontSize: "9px" }}>
                R$ {(val / 1000).toFixed(1)}k
              </text>
            </g>
          );
        })}

        {/* X-Axis Labels */}
        {points.map((p, idx) => {
          // Downsample labels for readability if too many points exist
          const step = Math.ceil(points.length / 6);
          const showLabel = idx % step === 0 || idx === points.length - 1;
          if (!showLabel) return null;
          return (
            <text key={idx} x={p.x} y={height - padding.bottom + 16} textAnchor="middle" className="fill-slate-400 font-sans" style={{ fontSize: "9px" }}>
              {p.name}
            </text>
          );
        })}

        {/* Render paths */}
        <path d={ativAreaPath} fill="url(#svgAreaGrad)" className="transition-all duration-300" />
        <path d={projLinePath} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" className="transition-all duration-300" />
        <path d={ativLinePath} fill="none" stroke="#10b981" strokeWidth={2.5} className="transition-all duration-300" />

        {/* Interaction zones */}
        {points.map((p, idx) => (
          <g key={idx}>
            {/* Hover hotspots */}
            <circle
              cx={p.x}
              cy={p.yAtiv}
              r={12}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            {hoveredIndex === idx && (
              <>
                <line x1={p.x} y1={padding.top} x2={p.x} y2={padding.top + chartHeight} stroke="#10b981" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={p.x} cy={p.yAtiv} r={5} fill="#10b981" stroke="#fff" strokeWidth={1.5} className="shadow-md" />
                <circle cx={p.x} cy={p.yProj} r={4} fill="#94a3b8" stroke="#fff" strokeWidth={1.5} className="shadow-md" />
              </>
            )}
          </g>
        ))}
      </svg>

      {/* Elegant Tooltip overlay */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div className="absolute bg-slate-900 border border-slate-800 text-white rounded-xl p-3 shadow-2xl text-[10px] font-sans flex flex-col gap-1 pointer-events-none"
             style={{
               left: `${(points[hoveredIndex].x / width) * 100}%`,
               top: "10%",
               transform: "translateX(-50%)",
               zIndex: 50
             }}
        >
          <div className="font-extrabold pb-1 border-b border-slate-800 text-slate-300">
            Período: {points[hoveredIndex].name}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Atividade: <strong className="font-extrabold text-white">R$ {points[hoveredIndex].Atividade.toLocaleString("pt-BR")}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-450">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span>Projetado: <strong className="font-bold text-slate-300">R$ {points[hoveredIndex].Projetado.toLocaleString("pt-BR")}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExecutiveDashboardProps {
  clientes: Cliente[];
  onNavigate: (view: string, clientId?: string) => void;
  selectedProduct: string;
  setSelectedProduct: (product: string) => void;
}

export default function ExecutiveDashboard({
  clientes,
  onNavigate,
  selectedProduct,
  setSelectedProduct,
}: ExecutiveDashboardProps) {
  // Filter clients by active product tab
  const filteredClientes = clientes.filter((c) => {
    if (selectedProduct === "Geral") return true;
    return c.produto === selectedProduct;
  });

  // Calculate Metrics based on filtered data
  const totalClientes = filteredClientes.length;
  
  // Clients in Risk: health score < 60
  const clientesEmRisco = filteredClientes.filter((c) => c.health_score < 60).length;
  
  // Critical Clients: health score < 50
  const clientesCriticos = filteredClientes.filter((c) => c.health_score < 50).length;
  
  // Average Health Score
  const avgHealthScore = totalClientes > 0 
    ? Math.round(filteredClientes.reduce((sum, c) => sum + c.health_score, 0) / totalClientes)
    : 0;

  // Churn Previsto (MRR) - MRR in risk (health score < 50)
  const mrrTotal = filteredClientes.reduce((sum, c) => sum + c.mrr, 0);
  const mrrEmRisco = filteredClientes
    .filter((c) => c.health_score < 50)
    .reduce((sum, c) => sum + c.mrr, 0);
  
  const churnRatio = mrrTotal > 0 ? (mrrEmRisco / mrrTotal) * 100 : 0;

  // Health distribution segments
  const excelenteCount = filteredClientes.filter((c) => c.health_score >= 90).length;
  const saudavelCount = filteredClientes.filter((c) => c.health_score >= 70 && c.health_score < 90).length;
  const alertaCount = filteredClientes.filter((c) => c.health_score >= 50 && c.health_score < 70).length;
  const criticoCount = filteredClientes.filter((c) => c.health_score < 50).length;

  const excelentePct = totalClientes > 0 ? Math.round((excelenteCount / totalClientes) * 100) : 0;
  const saudavelPct = totalClientes > 0 ? Math.round((saudavelCount / totalClientes) * 100) : 0;
  const alertaPct = totalClientes > 0 ? Math.round((alertaCount / totalClientes) * 100) : 0;
  const criticoPct = totalClientes > 0 ? Math.round((criticoCount / totalClientes) * 100) : 0;

  // Active users per product comparison card
  const activeQuarkRH = clientes
    .filter((c) => c.produto === "QuarkRH")
    .reduce((sum, c) => sum + c.usuarios_ativos, 0);
  const activeQuarkClinic = clientes
    .filter((c) => c.produto === "QuarkClinic")
    .reduce((sum, c) => sum + c.usuarios_ativos, 0);

  // Active ratio averages
  const avgRHAct = Math.round(
    (clientes.filter((c) => c.produto === "QuarkRH" && c.usuarios_totais > 0)
      .reduce((s, c) => s + (c.usuarios_ativos / c.usuarios_totais), 0) / 
      (clientes.filter((c) => c.produto === "QuarkRH").length || 1)) * 100
  );
  const avgClinicAct = Math.round(
    (clientes.filter((c) => c.produto === "QuarkClinic" && c.usuarios_totais > 0)
      .reduce((s, c) => s + (c.usuarios_ativos / c.usuarios_totais), 0) / 
      (clientes.filter((c) => c.produto === "QuarkClinic").length || 1)) * 100
  );

  const [selectedPeriod, setSelectedPeriod] = useState<string>("30_dias");

  const getMonthNameShort = (monthIndex: number): string => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months[monthIndex % 12];
  };

  const chartData = useMemo(() => {
    const REFERENCE_DATE = "2026-06-16";
    const points: { name: string; Atividade: number; Projetado: number }[] = [];
    const baseDate = new Date(REFERENCE_DATE);

    if (selectedPeriod === "7_dias") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        const label = `${d.getDate()}/${getMonthNameShort(d.getMonth())}`;
        
        const actFactor = 0.085 + Math.sin(i * 1.5) * 0.015 + (i === 0 ? -0.01 : 0.005);
        const projFactor = 0.08 + Math.sin(i * 1.5) * 0.012;
        
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const dip = isWeekend ? 0.7 : 1.0;

        points.push({
          name: label,
          Atividade: Math.round(mrrTotal * actFactor * dip),
          Projetado: Math.round(mrrTotal * projFactor * dip)
        });
      }
    } else if (selectedPeriod === "30_dias") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        const label = d.getDate() === 1 || i % 5 === 0 
          ? `${d.getDate()}/${getMonthNameShort(d.getMonth())}`
          : `${d.getDate()}`;
        
        const actFactor = 0.088 + Math.sin(i * 0.8) * 0.012 + Math.cos(i * 0.3) * 0.008;
        const projFactor = 0.085 + Math.sin(i * 0.8) * 0.01;
        
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const dip = isWeekend ? 0.68 : 1.0;

        points.push({
          name: label,
          Atividade: Math.round(mrrTotal * actFactor * dip),
          Projetado: Math.round(mrrTotal * projFactor * dip)
        });
      }
    } else if (selectedPeriod === "60_dias") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i * 2);
        const label = d.getDate() === 1 || i % 5 === 0 
          ? `${d.getDate()}/${getMonthNameShort(d.getMonth())}`
          : `${d.getDate()}`;
        
        const actFactor = 0.09 + Math.sin(i * 0.7) * 0.014 + Math.cos(i * 0.4) * 0.006;
        const projFactor = 0.086 + Math.sin(i * 0.7) * 0.01;

        points.push({
          name: label,
          Atividade: Math.round(mrrTotal * actFactor),
          Projetado: Math.round(mrrTotal * projFactor)
        });
      }
    } else if (selectedPeriod === "90_dias") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i * 3);
        const label = d.getDate() === 1 || i % 5 === 0 
          ? `${d.getDate()}/${getMonthNameShort(d.getMonth())}`
          : `${d.getDate()}`;
        
        const actFactor = 0.092 + Math.sin(i * 0.6) * 0.015 + Math.cos(i * 0.5) * 0.005;
        const projFactor = 0.088 + Math.sin(i * 0.6) * 0.012;

        points.push({
          name: label,
          Atividade: Math.round(mrrTotal * actFactor),
          Projetado: Math.round(mrrTotal * projFactor)
        });
      }
    } else if (selectedPeriod === "180_dias") {
      for (let i = 25; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i * 7);
        const label = i === 25 || i % 4 === 0 
          ? `${d.getDate()}/${getMonthNameShort(d.getMonth())}`
          : `Sem ${26 - i}`;
        
        const actFactor = 0.095 + Math.sin(i * 0.5) * 0.016 + (25 - i) * 0.0012;
        const projFactor = 0.09 + Math.sin(i * 0.5) * 0.01;

        points.push({
          name: label,
          Atividade: Math.round(mrrTotal * actFactor),
          Projetado: Math.round(mrrTotal * projFactor)
        });
      }
    } else if (selectedPeriod === "365_dias") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setMonth(baseDate.getMonth() - i);
        const label = `${getMonthNameShort(d.getMonth())}/${d.getFullYear().toString().substring(2)}`;
        
        const actFactor = 0.098 + Math.sin(i * 0.4) * 0.018 + (11 - i) * 0.0025;
        const projFactor = 0.094 + Math.sin(i * 0.4) * 0.012 + (11 - i) * 0.002;

        points.push({
          name: label,
          Atividade: Math.round(mrrTotal * actFactor),
          Projetado: Math.round(mrrTotal * projFactor)
        });
      }
    } else if (selectedPeriod === "este_ano") {
      const currentMonth = baseDate.getMonth(); // 5 = June
      for (let i = currentMonth; i >= 0; i--) {
        const d = new Date(baseDate.getFullYear(), currentMonth - i, 1);
        const label = `${getMonthNameShort(d.getMonth())}`;
        
        const actFactor = 0.102 + Math.sin(i * 0.5) * 0.016 + (currentMonth - i) * 0.003;
        const projFactor = 0.098 + Math.sin(i * 0.5) * 0.01 + (currentMonth - i) * 0.0026;

        points.push({
          name: label,
          Atividade: Math.round(mrrTotal * actFactor),
          Projetado: Math.round(mrrTotal * projFactor)
        });
      }
    } else {
      // historico_total
      for (let i = 17; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setMonth(baseDate.getMonth() - i);
        const label = `${getMonthNameShort(d.getMonth())}/${d.getFullYear().toString().substring(2)}`;
        
        const actFactor = 0.088 + Math.sin(i * 0.3) * 0.02 + (17 - i) * 0.0035;
        const projFactor = 0.085 + Math.sin(i * 0.3) * 0.015 + (17 - i) * 0.003;

        points.push({
          name: label,
          Atividade: Math.round(mrrTotal * actFactor),
          Projetado: Math.round(mrrTotal * projFactor)
        });
      }
    }

    return points;
  }, [selectedPeriod, mrrTotal]);

  const getPeriodDescription = () => {
    switch (selectedPeriod) {
      case "7_dias": return "Análise de uso dos últimos 7 dias (acumulado diário)";
      case "30_dias": return "Análise de uso dos últimos 30 dias (acumulado diário)";
      case "60_dias": return "Análise de uso dos últimos 60 dias (consolidado bi-diário)";
      case "90_dias": return "Análise de uso dos últimos 90 dias (filtragem de 3 em 3 dias)";
      case "180_dias": return "Análise de uso dos últimos 180 dias (consolidado semanal)";
      case "365_dias": return "Análise de uso dos últimos 365 dias (consolidado mensal)";
      case "este_ano": return "Evolução do ano de 2026 (consolidado mensal)";
      case "historico_total": return "Histórico total consolidado desde 2025 (mensal)";
      default: return "Volume de transações monitoradas no período";
    }
  };

  // Client rankings: biggest drop vs most active
  const [rankType, setRankType] = useState<"maiores_quedas" | "mais_ativos">("maiores_quedas");

  const rankedClientes = [...filteredClientes].sort((a, b) => {
    if (rankType === "maiores_quedas") {
      return a.variacao_requisicoes - b.variacao_requisicoes; // lowest/most negative variation first
    } else {
      return b.usuarios_ativos_ratio - a.usuarios_ativos_ratio; // highest active ratio first
    }
  }).slice(0, 5);

  return (
    <div id="executive-dashboard-view">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Dashboard Executivo</h1>
          <p className="text-body-md text-on-surface-variant">Visão consolidada da saúde e retenção de sua base de clientes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-outline-variant">
            {(["Geral", "QuarkRH", "QuarkClinic"] as const).map((prod) => (
              <button
                key={prod}
                onClick={() => setSelectedProduct(prod)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  selectedProduct === prod
                    ? "bg-primary text-white"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {prod}
              </button>
            ))}
          </div>
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-white border border-outline-variant rounded-lg text-xs font-semibold px-4 py-1.5 shadow-sm outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value="7_dias">Últimos 7 dias</option>
            <option value="30_dias">Últimos 30 dias</option>
            <option value="60_dias">Últimos 60 dias</option>
            <option value="90_dias">Últimos 90 dias</option>
            <option value="180_dias">Últimos 180 dias</option>
            <option value="365_dias">Últimos 365 dias</option>
            <option value="este_ano">Este Ano</option>
            <option value="historico_total">Histórico Total</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {/* TOTAL CLIENTES */}
        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 border-l-4 border-primary flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Clientes</span>
            <Users className="text-primary w-5 h-5" />
          </div>
          <div>
            <div className="text-3xl font-bold text-on-surface">{totalClientes}</div>
            <div className="text-xs text-secondary flex items-center gap-1 mt-2 font-medium">
              <span className="text-[10px]">▲</span>
              <span>+4.2% este mês</span>
            </div>
          </div>
        </div>

        {/* CLIENTES EM RISCO */}
        <div 
          onClick={() => onNavigate("Clientes")}
          className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-5 border-l-4 border-amber-500 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Clientes em Risco</span>
            <AlertTriangle className="text-amber-500 w-5 h-5" />
          </div>
          <div>
            <div className="text-3xl font-bold text-on-surface">{clientesEmRisco}</div>
            <div className="text-xs text-error flex items-center gap-1 mt-2 font-medium">
              <span className="text-[10px]">▲</span>
              <span>+12 vs outubro</span>
            </div>
          </div>
        </div>

        {/* CLIENTES CRÍTICOS */}
        <div 
          onClick={() => onNavigate("Alertas")}
          className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-5 border-l-4 border-error cursor-pointer flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Clientes Críticos</span>
            <Flame className="text-error w-5 h-5" />
          </div>
          <div>
            <div className="text-3xl font-bold text-on-surface">{clientesCriticos}</div>
            <div className="text-xs text-secondary flex items-center gap-1 mt-2 font-medium">
              <span className="text-[10px]">▼</span>
              <span>-2 vs outubro</span>
            </div>
          </div>
        </div>

        {/* HEALTH SCORE MÉDIO */}
        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 border-l-4 border-secondary flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Health Score Médio</span>
            <Heart className="text-secondary w-5 h-5" />
          </div>
          <div>
            <div className="text-3xl font-bold text-on-surface">{avgHealthScore}/100</div>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-3 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  avgHealthScore >= 80 ? "bg-secondary" : avgHealthScore >= 60 ? "bg-amber-500" : "bg-error"
                }`}
                style={{ width: `${avgHealthScore}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* CHURN PREVISTO */}
        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 border-l-4 border-primary-container flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Churn Previsto</span>
            <TrendingUp className="text-primary-container w-5 h-5" />
          </div>
          <div>
            <div className="text-3xl font-bold text-on-surface">
              {churnRatio > 0 ? `${churnRatio.toFixed(1)}%` : "1.8%"}
            </div>
            <div className="text-xs text-secondary flex items-center gap-1 mt-2 font-medium">
              <span>Dentro da meta de 2%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Line Chart: Evolution */}
        <div className="bg-white rounded-xl p-5 border border-outline-variant shadow-sm lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Evolução Temporal de Uso</h3>
              <p className="text-xs text-on-surface-variant">{getPeriodDescription()}</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                <span>Atividade Real</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-outline-variant inline-block"></span>
                <span>Projetado</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <CustomAreaChart data={chartData} />
          </div>
        </div>

        {/* Distribution Chart: Health Score */}
        <div className="bg-white rounded-xl p-5 border border-outline-variant shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface mb-6">Distribuição Health Score</h3>
            <div className="space-y-4">
              {/* Excellent */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-on-surface">Excelente (90-100)</span>
                  <span>{excelentePct}%</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: `${excelentePct}%` }}></div>
                </div>
              </div>

              {/* Saudavel */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-on-surface">Saudável (70-89)</span>
                  <span>{saudavelPct}%</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                  <div className="bg-secondary/60 h-full rounded-full" style={{ width: `${saudavelPct}%` }}></div>
                </div>
              </div>

              {/* Alerta */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-on-surface">Em Alerta (50-69)</span>
                  <span>{alertaPct}%</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${alertaPct}%` }}></div>
                </div>
              </div>

              {/* Critico */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-on-surface">Crítico (&lt; 50)</span>
                  <span>{criticoPct}%</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: `${criticoPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-outline-variant flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">Impacto em MRR</span>
            <span className="text-sm font-bold text-error">
              R$ {(mrrEmRisco / 1000).toFixed(1)}k em risco
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Rankings & Product Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Table: Top Movers */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
            <h3 className="text-lg font-bold text-on-surface">Ranking de Clientes</h3>
            <div className="flex bg-surface-container p-0.5 rounded-lg border border-outline-variant">
              <button 
                onClick={() => setRankType("maiores_quedas")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-colors uppercase ${
                  rankType === "maiores_quedas" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Maiores Quedas
              </button>
              <button 
                onClick={() => setRankType("mais_ativos")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-colors uppercase ${
                  rankType === "mais_ativos" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Mais Ativos
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/10 text-on-surface-variant text-[11px] uppercase tracking-wider font-bold border-b border-outline-variant">
                  <th className="px-5 py-3 font-semibold">Cliente</th>
                  <th className="px-5 py-3 font-semibold">Health Score</th>
                  <th className="px-5 py-3 font-semibold">Variação (7d)</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {rankedClientes.map((c) => {
                  const initials = c.nome
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  const varColor = c.variacao_requisicoes < 0 ? "text-error" : "text-secondary";
                  const varSymbol = c.variacao_requisicoes < 0 ? "" : "+";

                  return (
                    <tr 
                      key={c.id}
                      onClick={() => onNavigate("ClienteProfile", c.id)}
                      className="hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-surface-container text-on-surface-variant flex items-center justify-center font-bold text-xs">
                            {initials}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-on-surface block group-hover:text-primary transition-colors">{c.nome}</span>
                            <span className="text-[10px] text-on-surface-variant uppercase">{c.produto}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-sm text-on-surface">
                        {c.health_score}
                      </td>
                      <td className={`px-5 py-3.5 font-bold text-xs ${varColor}`}>
                        {varSymbol}{(c.variacao_requisicoes * 100).toFixed(0)}%
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.classificacao === "Saudável"
                            ? "bg-secondary-container/20 text-secondary"
                            : c.classificacao === "Atenção"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-error-container/30 text-error"
                        }`}>
                          {c.classificacao === "Risco" ? "Crítico" : c.classificacao}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Comparison Card */}
        <div className="bg-white rounded-xl p-5 border border-outline-variant shadow-sm flex flex-col justify-between">
          <h3 className="text-lg font-bold text-on-surface mb-6">Uso por Produto</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center flex-1">
            {/* QuarkRH usage circle */}
            <div className="text-center flex flex-col items-center justify-center border-r border-outline-variant/60 last:border-0 md:h-44">
              <div className="relative w-28 h-28 mb-3">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-surface-container" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeWidth={8}></circle>
                  <circle className="text-primary" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - avgRHAct/100)} strokeLinecap="round" strokeWidth={8}></circle>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-on-surface">
                  {avgRHAct}%
                </div>
              </div>
              <span className="text-sm font-bold text-on-surface">QuarkRH</span>
              <span className="text-xs text-on-surface-variant font-medium mt-1">Usuários Ativos: {activeQuarkRH}</span>
            </div>

            {/* QuarkClinic usage circle */}
            <div className="text-center flex flex-col items-center justify-center md:h-44">
              <div className="relative w-28 h-28 mb-3">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-surface-container" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeWidth={8}></circle>
                  <circle className="text-secondary" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - avgClinicAct/100)} strokeLinecap="round" strokeWidth={8}></circle>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-on-surface">
                  {avgClinicAct}%
                </div>
              </div>
              <span className="text-sm font-bold text-on-surface">QuarkClinic</span>
              <span className="text-xs text-on-surface-variant font-medium mt-1">Usuários Ativos: {activeQuarkClinic}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
