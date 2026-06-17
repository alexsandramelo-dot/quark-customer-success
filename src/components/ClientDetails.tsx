/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Cliente } from "../types";
import { ChevronRight, Share, Edit3, TrendingUp, Bolt, Users, Activity, MousePointerClick, CheckSquare, Layers, HelpCircle, AlertCircle, AlertTriangle, ArrowLeft } from "lucide-react";
// Custom pure SVG helper charts to avoid React 19 blackscreen crashes
interface BarPoint {
  name: string;
  Volume: number;
  Usuários: number;
}

function CustomBarChart({ data, valueType }: { data: BarPoint[]; valueType: "Volume" | "Usuários" }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-slate-400 font-sans">Sem dados</div>;

  const maxVal = Math.max(...data.map(d => valueType === "Volume" ? d.Volume : d.Usuários), 10);

  const padding = { top: 20, right: 10, bottom: 40, left: 45 };
  const width = 600;
  const height = 240;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barWidth = (chartWidth / data.length) * 0.45;
  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <div className="relative w-full h-full select-none" style={{ minHeight: "220px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {/* Grid lines */}
        {yTicks.map((val, idx) => {
          const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
          return (
            <g key={idx} className="opacity-90">
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth={1} />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 font-mono" style={{ fontSize: "9px" }}>
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, index) => {
          const val = valueType === "Volume" ? d.Volume : d.Usuários;
          const x = padding.left + (index / data.length) * chartWidth + (chartWidth / data.length) * 0.25;
          const barHeight = (val / maxVal) * chartHeight;
          const y = padding.top + chartHeight - barHeight;

          const isHovered = hoveredIndex === index;

          return (
            <g key={index}>
              {/* Actual bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={4}
                fill={isHovered ? "#10b981" : index === data.length - 1 ? "#006c49" : "#0f172a"}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />

              {/* Label X axis */}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                className="fill-slate-400 font-sans"
                style={{ fontSize: "9px" }}
              >
                {d.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div className="absolute bg-slate-900 border border-slate-800 text-white rounded-xl p-2.5 shadow-2xl text-[10px] font-sans pointer-events-none"
             style={{
               left: `${((padding.left + (hoveredIndex / data.length) * chartWidth + (chartWidth / data.length) * 0.45) / width) * 100}%`,
               top: "10%",
               transform: "translateX(-50%)",
               zIndex: 50
             }}
        >
          <div className="font-bold mb-0.5 text-center text-slate-300">{data[hoveredIndex].name}</div>
          <div className="text-emerald-400 font-extrabold text-center">
            {valueType}: {valueType === "Volume" ? data[hoveredIndex].Volume : data[hoveredIndex].Usuários}
          </div>
        </div>
      )}
    </div>
  );
}

interface ScorePoint {
  name: string;
  Score: number;
  Benchmark: number;
}

function CustomScoreLineChart({ data }: { data: ScorePoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-slate-400 font-sans">Sem dados</div>;

  const maxVal = 100;

  const padding = { top: 20, right: 20, bottom: 40, left: 45 };
  const width = 600;
  const height = 240;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Map coordinates
  const points = data.map((d, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const yScore = padding.top + chartHeight - (d.Score / maxVal) * chartHeight;
    const yBench = padding.top + chartHeight - (d.Benchmark / maxVal) * chartHeight;
    return { name: d.name, x, yScore, yBench, Score: d.Score, Benchmark: d.Benchmark };
  });

  // Create paths
  let scoreLinePath = "";
  let benchLinePath = "";

  if (points.length > 0) {
    scoreLinePath = `M ${points[0].x} ${points[0].yScore} ` + points.slice(1).map(p => `L ${p.x} ${p.yScore}`).join(" ");
    benchLinePath = `M ${points[0].x} ${points[0].yBench} ` + points.slice(1).map(p => `L ${p.x} ${p.yBench}`).join(" ");
  }

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="relative w-full h-full select-none" style={{ minHeight: "220px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {/* Grid lines */}
        {yTicks.map((val, idx) => {
          const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
          return (
            <g key={idx} className="opacity-90">
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth={1} />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 font-mono" style={{ fontSize: "9px" }}>
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* X Axis ticks */}
        {points.map((p, idx) => (
          <text key={idx} x={p.x} y={height - padding.bottom + 16} textAnchor="middle" className="fill-slate-400 font-sans" style={{ fontSize: "9px" }}>
            {p.name}
          </text>
        ))}

        {/* Benchmark line (dashed gray) */}
        <path d={benchLinePath} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" />
        {/* Score line (emerald bold) */}
        <path d={scoreLinePath} fill="none" stroke="#006c49" strokeWidth={2.5} />

        {/* Hover elements */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle
              cx={p.x}
              cy={p.yScore}
              r={12}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            {hoveredIndex === idx && (
              <>
                <line x1={p.x} y1={padding.top} x2={p.x} y2={padding.top + chartHeight} stroke="#006c49" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={p.x} cy={p.yScore} r={6} fill="#006c49" stroke="#fff" strokeWidth={1.5} className="shadow-md" />
                <circle cx={p.x} cy={p.yBench} r={4} fill="#94a3b8" stroke="#fff" strokeWidth={1.5} />
              </>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div className="absolute bg-slate-900 border border-slate-800 text-white rounded-xl p-3 shadow-2xl text-[10px] font-sans pointer-events-none"
             style={{
               left: `${(points[hoveredIndex].x / width) * 100}%`,
               top: "10%",
               transform: "translateX(-50%)",
               zIndex: 50
             }}
        >
          <div className="font-extrabold mb-1 text-slate-300 border-b border-slate-800 pb-0.5">{points[hoveredIndex].name}</div>
          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
            <span>Score: {points[hoveredIndex].Score}</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-450">
            <span>Benchmark: {points[hoveredIndex].Benchmark}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientDetailsProps {
  clientes: Cliente[];
  clienteId: string | null;
  onNavigate: (view: string, clientId?: string) => void;
  onEditClient?: (clientId: string) => void;
}

export default function ClientDetails({
  clientes,
  clienteId,
  onNavigate,
  onEditClient,
}: ClientDetailsProps) {
  // Safe lookup: find the requested client, otherwise default to first
  const activeId = clienteId || (clientes[0]?.id);
  const cliente = clientes.find((c) => c.id === activeId) || clientes[0];

  const [usageType, setUsageType] = useState<"Volume" | "Usuários">("Volume");
  const [localNotification, setLocalNotification] = useState<string | null>(null);

  if (!cliente) {
    return (
      <div className="p-8 text-center bg-white border border-outline rounded-lg">
        <p className="text-on-surface-variant font-semibold">Nenhum cliente disponível para exibição.</p>
        <button onClick={() => onNavigate("Geral")} className="text-primary hover:underline mt-4 font-bold text-xs">
          Voltar para o Dashboard
        </button>
      </div>
    );
  }

  // Handle simulations
  const handleSimulateAction = (msg: string) => {
    setLocalNotification(msg);
    setTimeout(() => {
      setLocalNotification(null);
    }, 4000);
  };

  // Convert client requisitions into styled monthly breakdown
  const mockMonthlyData = [
    { name: "Jan", Volume: Math.round(cliente.requisicoes_atual * 0.4), Usuários: Math.round(cliente.usuarios_ativos * 0.45) },
    { name: "Fev", Volume: Math.round(cliente.requisicoes_atual * 0.55), Usuários: Math.round(cliente.usuarios_ativos * 0.52) },
    { name: "Mar", Volume: Math.round(cliente.requisicoes_atual * 0.45), Usuários: Math.round(cliente.usuarios_ativos * 0.48) },
    { name: "Abr", Volume: Math.round(cliente.requisicoes_atual * 0.7), Usuários: Math.round(cliente.usuarios_ativos * 0.8) },
    { name: "Mai", Volume: Math.round(cliente.requisicoes_atual * 0.6), Usuários: Math.round(cliente.usuarios_ativos * 0.68) },
    { name: "Jun", Volume: Math.round(cliente.requisicoes_atual * 1.0), Usuários: Math.round(cliente.usuarios_ativos * 1.0) },
  ];

  // Benchmark line chart curves comparison
  const mockScoreEvolution = [
    { name: "JAN", Score: Math.max(20, cliente.health_score - 18), Benchmark: 62 },
    { name: "FEV", Score: Math.max(20, cliente.health_score - 15), Benchmark: 62 },
    { name: "MAR", Score: Math.max(20, cliente.health_score - 12), Benchmark: 61 },
    { name: "ABR", Score: Math.max(20, cliente.health_score - 8), Benchmark: 61 },
    { name: "MAI", Score: Math.max(20, cliente.health_score - 4), Benchmark: 63 },
    { name: "JUN", Score: cliente.health_score, Benchmark: 64 },
  ];

  // Specific risk label calculation
  const isHighRisk = cliente.health_score < 50;
  const churnProbability = isHighRisk ? "Alta (45%)" : cliente.health_score < 80 ? "Média (15%)" : "Baixo (5%)";
  const churnColor = isHighRisk ? "text-error font-bold" : cliente.health_score < 80 ? "text-amber-600 font-semibold" : "text-secondary font-bold";

  // Initials
  const initials = cliente.nome
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div id="customer-details-view">
      {/* Toast alert */}
      {localNotification && (
        <div className="fixed top-4 right-4 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-4 rounded-xl shadow-xl flex items-center gap-3">
          <AlertCircle className="text-secondary-fixed w-5 h-5 flex-shrink-0" />
          <span className="text-xs font-semibold leading-normal">{localNotification}</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-on-surface-variant mb-2 text-xs font-semibold">
            <button onClick={() => onNavigate("Clientes")} className="hover:text-primary transition-colors">CLIENTES</button>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-primary text-[10px] tracking-wider font-bold">DETALHES</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate("Clientes")}
              className="p-1 border border-outline-variant rounded-md hover:bg-surface-container text-on-surface-variant mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl font-bold text-on-surface">{cliente.nome}</h1>
            <span className="px-3 py-0.5 bg-secondary-container/10 text-secondary text-[10px] font-bold rounded-full border border-secondary/20">
              Ativo
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            ID: QK-{cliente.id} • Produto: <strong className="text-on-surface uppercase">{cliente.produto}</strong> • Cliente desde: 14 de Março, 2022
          </p>
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={() => handleSimulateAction(`Ações de exportação preparadas para o relatório consolidado de ${cliente.nome}`)}
            className="flex items-center gap-2 px-4 py-2 border border-outline-variant hover:bg-surface-container font-semibold rounded-lg text-xs shadow-sm transition-all text-on-surface"
          >
            <Share className="w-4 h-4 text-on-surface-variant" />
            Exportar Relatório
          </button>
          <button 
            onClick={() => onEditClient?.(cliente.id)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:opacity-90 transition-all text-xs shadow-sm"
          >
            <Edit3 className="w-4 h-4" />
            Editar Cliente
          </button>
        </div>
      </div>

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Left Card: Painel de Saude (Large Vertical Card) */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-xl p-5 border border-outline-variant shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Painel de Saúde</h3>
              <p className="text-[11px] text-on-surface-variant">Visão geral do score atual</p>
            </div>
            <div className="flex items-center gap-1 text-secondary font-bold text-xs">
              <TrendingUp className="w-4 h-4" />
              <span>+4.2%</span>
            </div>
          </div>

          {/* SVG Gauge structure */}
          <div className="flex flex-col items-center justify-center py-6 relative">
            <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 100 100">
              <circle 
                className="text-surface-container" 
                cx="50" 
                cy="50" 
                fill="transparent" 
                r="40" 
                stroke="currentColor" 
                strokeWidth={9}
              ></circle>
              <circle 
                className={`${
                  cliente.health_score >= 80 
                    ? "text-secondary" 
                    : cliente.health_score >= 60 
                    ? "text-amber-500" 
                    : "text-error"
                }`} 
                cx="50" 
                cy="50" 
                fill="transparent" 
                r="40" 
                stroke="currentColor" 
                strokeDasharray="251.2" 
                strokeDashoffset={251.2 * (1 - cliente.health_score / 100)} 
                strokeLinecap="round" 
                strokeWidth={9}
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-3">
              <span className="text-4xl font-extrabold text-on-surface tracking-tight">{cliente.health_score}</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">
                {cliente.classificacao}
              </span>
            </div>
          </div>

          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 text-xs">
            <div className="flex justify-between mb-2">
              <span className="text-on-surface-variant font-medium">Última atualização</span>
              <span className="font-bold text-on-surface">Hoje, 09:42</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant font-medium">Probabilidade de Churn</span>
              <span className={churnColor}>{churnProbability}</span>
            </div>
          </div>
        </div>

        {/* Right Cards: Usage Metrics Grid */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Card 1: Dias Ativo */}
          <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2 bg-primary-fixed rounded-lg text-on-primary-fixed">
                <Bolt className="w-4 h-4 fill-on-primary-fixed/20" />
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Dias Ativo</span>
            </div>
            <p className="text-2xl font-extrabold text-on-surface">
              {cliente.dias_sem_uso === 0 ? "Hoje Ativo" : `${30 - cliente.dias_sem_uso} Dias`}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-2">
              {cliente.dias_sem_uso === 0 ? "Última atividade realizada hoje" : `Última atividade: ${cliente.dias_sem_uso} dias atrás`}
            </p>
          </div>

          {/* Card 2: Usuarios Ativos */}
          <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2 bg-secondary-fixed-dim rounded-lg text-on-secondary-fixed">
                <Users className="w-4 h-4 fill-on-secondary-fixed/20" />
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Usuários Ativos</span>
            </div>
            <p className="text-2xl font-extrabold text-on-surface">{cliente.usuarios_ativos}</p>
            <p className="text-[11px] text-secondary mt-2 font-bold flex items-center gap-1">
              <span>▲ 12% vs mês ant.</span>
            </p>
          </div>

          {/* Card 3: Media Req */}
          <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2 bg-tertiary-fixed rounded-lg text-on-tertiary-fixed">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Média Req.</span>
            </div>
            <p className="text-2xl font-extrabold text-on-surface">{(cliente.requisicoes_atual / 1000).toFixed(1)}k</p>
            <p className="text-[11px] text-on-surface-variant mt-2 font-medium">Por período diário</p>
          </div>

          {/* Card 4: Engajamento */}
          <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-3">
              <div className="p-1.5 bg-surface-container rounded-lg text-on-surface">
                <MousePointerClick className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Engajamento</span>
            </div>
            <p className="text-2xl font-extrabold text-on-surface">
              {cliente.usuarios_totais > 0 ? `${Math.round((cliente.requisicoes_atual / cliente.usuarios_totais))} req/user` : "78%"}
            </p>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-3 overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: "78%" }}></div>
            </div>
          </div>

          {/* Card 5: Adocao */}
          <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-3">
              <div className="p-1.5 bg-surface-container rounded-lg text-on-surface">
                <CheckSquare className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Adoção</span>
            </div>
            <p className="text-2xl font-extrabold text-on-surface">
              {Math.round((cliente.variaveis_utilizadas.length / cliente.total_variaveis_disponiveis) * 100)}%
            </p>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-3 overflow-hidden">
              <div className="bg-secondary h-full rounded-full" style={{ width: `${Math.round((cliente.variaveis_utilizadas.length / cliente.total_variaveis_disponiveis) * 100)}%` }}></div>
            </div>
          </div>

          {/* Card 6: Profundidade */}
          <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-3">
              <div className="p-1.5 bg-surface-container rounded-lg text-on-surface">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Profundidade</span>
            </div>
            <p className="text-2xl font-extrabold text-on-surface">64%</p>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-3 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: "64%" }}></div>
            </div>
          </div>
        </div>

        {/* Monthly breakdown block (Left area bottom) */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-outline-variant p-5 rounded-xl shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Histórico Mensal de Uso</h3>
              <p className="text-xs text-on-surface-variant">Volume de interações por plataforma nos últimos 6 meses</p>
            </div>
            <div className="flex bg-surface-container p-0.5 rounded-lg border border-outline-variant">
              {(["Volume", "Usuários"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setUsageType(type)}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors uppercase ${
                    usageType === type ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <CustomBarChart data={mockMonthlyData} valueType={usageType} />
          </div>
        </div>

        {/* Current client active alerts center (Right side list) */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/20">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Alertas Recentes</h3>
            {cliente.alertas_ativos.length > 0 ? (
              <span className="bg-error-container/60 text-error px-2 py-0.5 rounded text-[10px] font-bold">
                {cliente.alertas_ativos.length} CRÍTICOS
              </span>
            ) : (
              <span className="bg-secondary-container/20 text-secondary px-2 py-0.5 rounded text-[10px] font-bold">
                Sem Alertas
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[295px] divide-y divide-outline-variant/30">
            {cliente.alertas_ativos.length === 0 ? (
              <div className="p-10 text-center text-on-surface-variant font-medium text-xs">
                Nenhum sinal crítico ou comportamento de churn detectado para esta conta.
              </div>
            ) : (
              cliente.alertas_ativos.map((alt, idx) => (
                <div key={idx} className="p-5 hover:bg-surface-container-low/20 transition-all">
                  <div className="flex gap-3">
                    <div className="text-error mt-0.5 flex-shrink-0">
                      <AlertCircle className="w-5 h-5 fill-error/10 stroke-[2.5]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface leading-tight">{alt.tipo}</p>
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Sinal verificado na data de {alt.data_alerta}. Atendimento CS consultivo recomendado.
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-primary">
                        <span>Há 2 horas</span>
                        <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
                        <button 
                          onClick={() => handleSimulateAction(`Ação para o alerta "${alt.tipo}" registrada com sucesso!`)}
                          className="hover:underline text-primary"
                        >
                          Resolver
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Simulated interactive tickets */}
            <div className="p-5 hover:bg-surface-container-low/20 transition-all">
              <div className="flex gap-3">
                <div className="text-amber-500 mt-0.5 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 fill-amber-500/10" />
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface leading-tight">Ticket de alta prioridade aberto</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Erro crítico reportado na integração com o módulo Financeiro.</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-primary">
                    <span>Há 6 horas</span>
                    <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
                    <button 
                      onClick={() => handleSimulateAction("Abrindo visualização de ticket de suporte via integrações...")}
                      className="hover:underline text-primary font-bold"
                    >
                      Ver Ticket
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => handleSimulateAction("Carregando logs históricos completos de atendimentos da conta...")}
            className="p-4 text-center text-xs font-bold text-on-surface-variant hover:bg-surface-container border-t border-outline-variant transition-all"
          >
            Ver histórico de contatos completo
          </button>
        </div>

        {/* Evolution of Health Score - Area Graphic curve comparing benchmark */}
        <div className="col-span-12 bg-white rounded-xl p-5 border border-outline-variant shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <div>
              <h3 className="text-base font-bold text-on-surface">Evolução do Health Score</h3>
              <p className="text-xs text-on-surface-variant">Progressão histórica de integridade da conta contra o benchmark do segmento</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-secondary rounded-full inline-block"></span>
                <span>Health Score</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-outline inline-block rounded-full"></span>
                <span>Benchmark Segmento</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <CustomScoreLineChart data={mockScoreEvolution} />
          </div>
        </div>
      </div>
    </div>
  );
}
