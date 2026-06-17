/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Cliente } from "../types";
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw, Filter, ArrowRight, UserCheck, MessageSquare, Plus, Check } from "lucide-react";

interface AlertsCenterProps {
  clientes: Cliente[];
  onNavigate: (view: string, clientId?: string) => void;
  onRefreshBase: () => void;
  onResolveAlert: (clientId: string, alertType: string) => void;
}

export default function AlertsCenter({
  clientes,
  onNavigate,
  onRefreshBase,
  onResolveAlert,
}: AlertsCenterProps) {
  // Filter states
  const [selectedProduct, setSelectedProduct] = useState<string>("Todos os Produtos");
  const [selectedType, setSelectedType] = useState<"Todos" | "Sistema" | "Engajamento">("Todos");

  // Local notifications array for action simulation
  const [notification, setNotification] = useState<string | null>(null);

  // Parse all current active alerts across the entire base
  interface ConsolidatedAlert {
    clienteId: string;
    nomeCliente: string;
    plano: string;
    produto: "QuarkRH" | "QuarkClinic";
    tipoAlerta: string;
    severidade: "Crítico" | "Atenção";
    dataAlerta: string;
    motivoVisual: string;
    detalhesExtras?: string;
    status: "Pendente" | "Em Atendimento" | "Resolvido";
  }

  // Prepopulate standard table alerts based on active alerts count
  const allAlerts: ConsolidatedAlert[] = [];

  clientes.forEach((c) => {
    c.alertas_ativos.forEach((a) => {
      // Build visual cause string
      let cause = a.tipo;
      let details = "";
      if (a.tipo === "Sem atividade há mais de 7 dias") {
        cause = `Sem atividade de Admin há ${c.dias_sem_uso} dias`;
        details = "Risco Iminente de cancelamento de licenças";
      } else if (a.tipo === "Queda de uso acima de 30%") {
        cause = `Queda de ${Math.abs(Math.round(c.variacao_requisicoes * 100))}% no volume de requisições`;
        details = "Comparado à média das últimas 4 semanas";
      } else if (a.tipo === "Apenas 1 usuário ativo") {
        cause = "Apenas 1 usuário ativo na plataforma";
        details = "Baixo engajamento ou perda de contato chave";
      } else if (a.tipo === "Zero usuários ativos") {
        cause = "Zero usuários ativos no produto";
        details = "Possível desinstalação ou abandono total";
      } else if (a.tipo === "Health Score abaixo de 50") {
        cause = `Health Score crítico em nível ${c.health_score}`;
        details = "Baixa profundidade e adoção técnica detectados";
      }

      // Check if system-involved or engagement-involved select
      const isSystem = a.tipo.includes("SLA") || a.tipo.includes("Score") || a.tipo.includes("1");
      const categoryType = isSystem ? "Sistema" : "Engajamento";

      // Match filter checks
      if (selectedProduct !== "Todos os Produtos") {
        if (selectedProduct === "QuarkRH Core" && c.produto !== "QuarkRH") return;
        if (selectedProduct === "QuarkClinic ERP" && c.produto !== "QuarkClinic") return;
      }

      if (selectedType !== "Todos" && categoryType !== selectedType) {
        return;
      }

      allAlerts.push({
        clienteId: c.id,
        nomeCliente: c.nome,
        plano: c.plano,
        produto: c.produto,
        tipoAlerta: a.tipo,
        severidade: a.severidade,
        dataAlerta: a.data_alerta,
        motivoVisual: cause,
        detalhesExtras: details,
        status: a.resolvido ? "Resolvido" : c.health_score < 40 ? "Pendente" : "Em Atendimento"
      });
    });
  });

  // KPI summaries for bento cards
  const criticosTot = allAlerts.filter((a) => a.severidade === "Crítico" && a.status !== "Resolvido").length;
  const provavelChurnTot = clientes.filter((c) => c.health_score < 50).length;
  const pontosAtencaoTot = allAlerts.filter((a) => a.severidade === "Atenção" && a.status !== "Resolvido").length;

  // Simulator helper to trigger predictive reports
  const triggerPredictiveReport = () => {
    setNotification(
      "Análise Preditiva de IA QUARK gerada! 5 clientes mostram 90%+ padrão de contratação restaurada e 2 necessitam de contato consultivo imediato. Relatório PDF enviado ao seu e-mail manager."
    );
    setTimeout(() => {
      setNotification(null);
    }, 7000);
  };

  const assignOperador = (alert: ConsolidatedAlert) => {
    setNotification(`Cliente "${alert.nomeCliente}" foi atribuído aos seus atendimentos em andamento.`);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  return (
    <div id="alerts-center-view">
      {/* Alert toast notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 max-w-md animate-bounce">
          <AlertCircle className="text-secondary-fixed w-6 h-6 flex-shrink-0" />
          <span className="text-xs font-semibold leading-relaxed">{notification}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8 flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Central de Alertas</h2>
          <p className="text-body-md text-on-surface-variant">Monitore riscos e aja preventivamente na sua base de clientes.</p>
        </div>
        <div className="flex gap-2.5">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-lg text-xs font-semibold hover:bg-surface-container-highest transition-colors">
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </button>
          <button 
            onClick={() => { onRefreshBase(); setNotification("Base de dados de telemetria sincronizada com sucesso!"); setTimeout(() => setNotification(null), 3000); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar Base
          </button>
        </div>
      </div>

      {/* Severity Summary (Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Critical */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error">
              <AlertCircle className="w-5 h-5 fill-error/20" />
            </div>
            <span className="text-[10px] font-bold text-error bg-error/10 px-2.5 py-0.5 rounded-full">Crítico</span>
          </div>
          <div>
            <div className="text-4xl font-bold mb-1">{criticosTot}</div>
            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Alertas Críticos</div>
            <p className="text-[10px] text-error mt-2 flex items-center gap-1 font-medium">
              <span>▲ +4 desde ontem</span>
            </p>
          </div>
        </div>

        {/* Card 2: Churn Provável */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5 fill-amber-500/20" />
            </div>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-500/10 px-2.5 py-0.5 rounded-full">Churn Provável</span>
          </div>
          <div>
            <div className="text-4xl font-bold mb-1">{provavelChurnTot}</div>
            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Risco de Churn</div>
            <p className="text-[10px] text-amber-700 mt-2 flex items-center gap-1 font-medium">
              <span>— Estável este período</span>
            </p>
          </div>
        </div>

        {/* Card 3: Pontos de Atenção */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-secondary-container/20 flex items-center justify-center text-secondary">
              <AlertCircle className="w-5 h-5 fill-secondary/20" />
            </div>
            <span className="text-[10px] font-bold text-secondary bg-secondary-container/20 px-2.5 py-0.5 rounded-full">Atenção</span>
          </div>
          <div>
            <div className="text-4xl font-bold mb-1">{pontosAtencaoTot}</div>
            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pontos de Atenção</div>
            <p className="text-[10px] text-secondary mt-2 flex items-center gap-1 font-medium">
              <span>▼ -2 desde ontem</span>
            </p>
          </div>
        </div>

        {/* Card 4: Meta de Retenção */}
        <div className="bg-primary p-5 rounded-xl border border-primary shadow-sm flex flex-col justify-between text-white">
          <div>
            <div className="text-[10px] font-bold uppercase opacity-80 mb-1 tracking-wider">Meta de Retenção</div>
            <div className="text-3xl font-bold">94.2%</div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div className="bg-secondary-fixed h-full w-[94.2%] transition-all duration-500 shadow-[0_0_8px_rgba(111,251,190,0.5)]"></div>
            </div>
            <p className="text-[10px] mt-1.5 opacity-90 font-medium">+0.5% este mês</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-container-low p-4 rounded-xl mb-6 flex flex-wrap items-center gap-6 border border-outline-variant/60">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Produto:</label>
          <select 
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="bg-white border border-outline-variant/50 rounded-md px-3 py-1.5 text-xs font-semibold focus:border-primary outline-none min-w-[160px] shadow-sm"
          >
            <option>Todos os Produtos</option>
            <option>QuarkRH Core</option>
            <option>QuarkClinic ERP</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Tipo:</label>
          <div className="flex bg-surface-container-highest p-0.5 rounded-lg gap-0.5 border border-outline-variant/40 shadow-sm">
            {(["Todos", "Sistema", "Engajamento"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedType === t
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-white/30"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="sm:ml-auto flex gap-4 text-xs font-semibold text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-error inline-block"></span>
            <span>Crítico</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span>Churn Provável</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block"></span>
            <span>Atenção</span>
          </div>
        </div>
      </div>

      {/* Alarms Table */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant uppercase">
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Tipo / Produto</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Motivo do Alerta</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Data / Severidade</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {allAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant font-semibold">
                    Não há alertas pendentes nesta base com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                allAlerts.map((a, idx) => {
                  const initial = a.nomeCliente.substring(0, 2).toUpperCase();
                  
                  return (
                    <tr 
                      key={`${a.clienteId}-${idx}`}
                      className="hover:bg-surface-container-low/30 transition-colors group"
                    >
                      {/* Name card */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded bg-primary text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {initial}
                          </div>
                          <div>
                            <p 
                              onClick={() => onNavigate("ClienteProfile", a.clienteId)}
                              className="text-xs font-bold text-on-surface hover:text-primary hover:underline transition-colors cursor-pointer"
                            >
                              {a.nomeCliente}
                            </p>
                            <p className="text-[10px] text-on-surface-variant">Contrato: {a.plano}</p>
                          </div>
                        </div>
                      </td>

                      {/* Product details */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-on-surface">{a.tipoAlerta}</p>
                        <span className="text-[9px] text-on-surface-variant uppercase bg-surface-container/80 px-2 py-0.5 rounded-md inline-block font-semibold mt-1">
                          {a.produto.toUpperCase()}
                        </span>
                      </td>

                      {/* Visual Reason */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-semibold text-on-surface">{a.motivoVisual}</p>
                        {a.detalhesExtras && (
                          <span className="text-[10px] text-error font-medium flex items-center gap-1 mt-1.5 uppercase">
                            <AlertCircle className="w-3 h-3 flex-shrink-0 stroke-[2.5]" />
                            {a.detalhesExtras}
                          </span>
                        )}
                      </td>

                      {/* Date and severity dots representation */}
                      <td className="px-6 py-4">
                        <p className="text-xs text-on-surface font-semibold">{a.dataAlerta}</p>
                        <div className="flex gap-1 mt-2">
                          <div className={`h-1 w-4 rounded-full ${a.severidade === "Crítico" ? "bg-error animate-pulse" : "bg-amber-500"}`}></div>
                          <div className={`h-1 w-4 rounded-full ${a.severidade === "Crítico" ? "bg-error" : "bg-outline-variant"}`}></div>
                          <div className={`h-1 w-4 rounded-full ${a.severidade === "Crítico" ? "bg-error" : "bg-outline-variant"}`}></div>
                        </div>
                      </td>

                      {/* Status badge representation */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          a.status === "Pendente" 
                            ? "bg-error-container/30 text-error" 
                            : a.status === "Em Atendimento" 
                            ? "bg-amber-100 text-amber-800" 
                            : "bg-secondary-container/20 text-secondary"
                        }`}>
                          {a.status}
                        </span>
                      </td>

                      {/* Interactive Buttons */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => assignOperador(a)}
                            title="Atribuir a mim"
                            className="p-1.5 bg-surface-container rounded-lg hover:bg-primary hover:text-white transition-all text-on-surface-variant"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { onResolveAlert(a.clienteId, a.tipoAlerta); setNotification(`Alerta de "${a.nomeCliente}" marcado como resolvido!`); setTimeout(() => setNotification(null), 3000); }}
                            title="Resolver"
                            className="p-1.5 bg-surface-container rounded-lg hover:bg-secondary hover:text-white transition-all text-on-surface-variant"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty space action items card */}
      <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-2 gap-6">
        {/* IA Predictor Card */}
        <div className="bg-primary-container p-6 rounded-2xl relative overflow-hidden group">
          <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px] text-white">
            <div>
              <h3 className="text-xl font-bold mb-1">Precisa de Análise Profunda?</h3>
              <p className="text-xs text-white/70 max-w-sm">Use nossa inteligência artificial para antecipar comportamentos baseados no histórico de alertas dos últimos 6 meses.</p>
            </div>
            <button 
              onClick={triggerPredictiveReport}
              className="mt-4 w-fit px-5 py-2.5 bg-white text-primary font-bold rounded-xl flex items-center gap-2 hover:gap-3 transition-all text-xs"
            >
              Gerar Relatório Preditivo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute -bottom-8 -right-8 text-white opacity-5 transform rotate-12 transition-transform group-hover:scale-110 duration-500">
            <RefreshCw className="w-44 h-44" />
          </div>
        </div>

        {/* Trigger Creator Card */}
        <div className="border-2 border-dashed border-outline-variant rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-on-surface">Configurar Novo Gatilho</h4>
            <p className="text-xs text-on-surface-variant max-w-xs">Crie alertas customizados com base em telemetria e fluxos de dados.</p>
          </div>
          <button 
            onClick={() => setNotification("O Editor de gatilhos automáticos foi carregado nas Configurações.")}
            className="px-5 py-2 bg-surface-container-highest text-on-surface font-bold rounded-xl border border-outline-variant hover:bg-surface-container transition-colors text-xs"
          >
            Abrir Editor de Regras
          </button>
        </div>
      </div>
    </div>
  );
}
