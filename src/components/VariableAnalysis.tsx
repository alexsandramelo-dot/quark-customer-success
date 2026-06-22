/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Cliente } from "../types";
import { ChevronRight, Percent, Info, Search, Heart, Sparkles, Filter, ExternalLink } from "lucide-react";

interface VariableAnalysisProps {
  clientes: Cliente[];
  onNavigate: (view: string, clientId?: string) => void;
}

export default function VariableAnalysis({
  clientes,
  onNavigate,
}: VariableAnalysisProps) {
  const [productFilter, setProductFilter] = useState<"Geral" | "QuarkRH" | "QuarkClinic">("Geral");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [aiReportOpen, setAiReportOpen] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Detailed standard variables dictionary for QuarkRH and QuarkClinic
  interface VariableDef {
    codigo: string;
    nomeAmigavel: string;
    descricao: string;
    produto: "QuarkRH" | "QuarkClinic" | "Ambos";
    categoria: "Uso Essencial" | "Relatórios" | "Integração" | "Configuração";
    impactoChurn: "Muito Alto" | "Alto" | "Médio" | "Baixo";
  }

  const variablesList: VariableDef[] = [
    {
      codigo: "LOGIN_FREQ",
      nomeAmigavel: "Frequência de Login",
      descricao: "Acessos frequentes ao painel administrativo principal.",
      produto: "Ambos",
      categoria: "Uso Essencial",
      impactoChurn: "Muito Alto",
    },
    {
      codigo: "FEAT_DASH_CLICK",
      nomeAmigavel: "Interação com Dashboard",
      descricao: "Cliques em cartões de desempenho ou gráficos dinâmicos.",
      produto: "Ambos",
      categoria: "Uso Essencial",
      impactoChurn: "Alto",
    },
    {
      codigo: "USER_INVITE_COUNT",
      nomeAmigavel: "Convites de Novos Colaboradores",
      descricao: "Utilização das licenças contratadas convidando usuários.",
      produto: "QuarkRH",
      categoria: "Configuração",
      impactoChurn: "Muito Alto",
    },
    {
      codigo: "REPORTS_EXP_PDF",
      nomeAmigavel: "Exportações de Relatórios PDF/Excel",
      descricao: "Geração de documentos fechados para envios ou auditoria.",
      produto: "Ambos",
      categoria: "Relatórios",
      impactoChurn: "Médio",
    },
    {
      codigo: "USER_ROLE_CONFIG",
      nomeAmigavel: "Configuração de Perfis e Permissões",
      descricao: "Definição de permissões avançadas de segurança e papéis.",
      produto: "QuarkRH",
      categoria: "Configuração",
      impactoChurn: "Baixo",
    },
    {
      codigo: "INTEG_SYNC_ERR",
      nomeAmigavel: "Erros de Sincronização API/Suites",
      descricao: "Ocorrência de falha no sincronismo com serviços do cliente.",
      produto: "Ambos",
      categoria: "Integração",
      impactoChurn: "Alto",
    },
    {
      codigo: "AUDIT_LOG_VIEW",
      nomeAmigavel: "Verificação de Logs de Auditoria",
      descricao: "Visualização de segurança interna por administradores.",
      produto: "QuarkRH",
      categoria: "Relatórios",
      impactoChurn: "Baixo",
    },
    {
      codigo: "DEPT_BUILDER",
      nomeAmigavel: "Organizador de Estruturas Quark",
      descricao: "Mapeamento estrutural de departamentos e departamentos clínicos.",
      produto: "QuarkRH",
      categoria: "Configuração",
      impactoChurn: "Médio",
    },
    {
      codigo: "API_LEGACY_CALLS",
      nomeAmigavel: "Chamadas de Endpoints Legados",
      descricao: "Acesso por conectores legados que geram gargalos.",
      produto: "Ambos",
      categoria: "Integração",
      impactoChurn: "Alto",
    },
    {
      codigo: "SCHEDULER_EDIT",
      nomeAmigavel: "Edição de Calendário Médico",
      descricao: "Modificação ativa de grade de plantões e agendamentos.",
      produto: "QuarkClinic",
      categoria: "Uso Essencial",
      impactoChurn: "Muito Alto",
    },
    {
      codigo: "PATIENT_INSPECT",
      nomeAmigavel: "Inspeção de Ficha de Paciente",
      descricao: "Leitura técnica ou preenchimento de prontuários eletrônicos.",
      produto: "QuarkClinic",
      categoria: "Uso Essencial",
      impactoChurn: "Muito Alto",
    },
    {
      codigo: "BILLING_SUBMIT",
      nomeAmigavel: "Faturamento de Guias de Convênio",
      descricao: "Cálculo e exportação de XML TISS para operadoras de saúde.",
      produto: "QuarkClinic",
      categoria: "Relatórios",
      impactoChurn: "Alto",
    }
  ];

  // Dynamic adoption percentage calculations based on current client database
  const finalAnalysisList = variablesList.map((val) => {
    // Total eligible clients for this feature
    const eligibleClients = clientes.filter((c) => {
      if (val.produto === "Ambos") return true;
      return c.produto === val.produto;
    });

    const activeUsing = eligibleClients.filter((c) => 
      c.variaveis_utilizadas.some((v) => v.trim() === val.codigo)
    );

    const percentAdoption = eligibleClients.length > 0 
      ? Math.round((activeUsing.length / eligibleClients.length) * 100)
      : 0;

    return {
      ...val,
      percentAdoption,
      activeClientsCount: activeUsing.length,
      totalClientsCount: eligibleClients.length
    };
  });

  // Filter based on controls
  const filteredAnalysis = finalAnalysisList.filter((v) => {
    // Product check
    if (productFilter !== "Geral") {
      if (v.produto !== "Ambos" && v.produto !== productFilter) return false;
    }
    // Search check
    if (searchTerm.trim().length > 0) {
      const q = searchTerm.toLowerCase();
      const codeMatch = v.codigo.toLowerCase().includes(q);
      const nameMatch = v.nomeAmigavel.toLowerCase().includes(q);
      const descMatch = v.descricao.toLowerCase().includes(q);
      if (!codeMatch && !nameMatch && !descMatch) return false;
    }
    return true;
  });

  // Categorize for Highlights cards
  const sortedByAdoption = [...finalAnalysisList].sort((a, b) => b.percentAdoption - a.percentAdoption);
  const topAdopted = sortedByAdoption.slice(0, 3);
  const lowestAdopted = sortedByAdoption.filter(v => v.percentAdoption < 35).slice(0, 3);

  // Trigger simulated Gemini intelligence
  const generateGeminiSuggestions = () => {
    setAiLoading(true);
    setTimeout(() => {
      setAiLoading(false);
      setAiReportOpen(true);
    }, 1500);
  };

  return (
    <div id="variable-analysis-view">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <nav className="text-xs font-semibold text-on-surface-variant flex items-center gap-1 mb-2">
            <span>Análise</span>
            <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
            <span className="text-primary text-[10px] tracking-wider font-bold">VARIÁVEIS DE PRODUTO</span>
          </nav>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Análise de Variáveis</h2>
          <p className="text-body-md text-on-surface-variant">Identifique o nível de adoção técnica de cada feature dos produtos QuarkRH e QuarkClinic.</p>
        </div>
        <button 
          onClick={generateGeminiSuggestions}
          className="flex items-center gap-2 bg-primary text-white font-semibold hover:opacity-90 transition px-4 py-2.5 rounded-lg text-xs shadow-sm"
        >
          <Sparkles className="w-4 h-4 text-secondary-fixed animate-pulse" />
          {aiLoading ? "Analisando com Gemini..." : "IA: Plano de Engajamento"}
        </button>
      </div>

      {/* AI Suggestions modal simulation */}
      {aiReportOpen && (
        <div className="mb-8 p-6 bg-primary-container text-white rounded-2xl relative overflow-hidden shadow-lg border border-primary/20 animate-fade-in">
          <div className="absolute top-4 right-4 bg-white/25 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-secondary-fixed" />
            Gemini Core
          </div>
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            Plano de Engajamento Recomendado pela IA
          </h3>
          <p className="text-xs text-white/80 max-w-3xl leading-relaxed mb-4">
            Analisamos o comportamento das variáveis da sua base atual de clientes. Aqui estão 3 ações táticas prioritárias com base na adoção técnica:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
            <div className="bg-white/10 p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-fixed">Caso 1: Baixo uso de API_LEGACY_CALLS</span>
              <p className="text-xs font-bold text-white mt-1">Estimular Conexão Segura</p>
              <p className="text-[11px] text-white/70 mt-1">Clientes como LogiMove Solutions estão usando endpoints instáveis. Enviar convite automático para migração à API v2.</p>
            </div>
            <div className="bg-white/10 p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-fixed">Caso 2: Alinhamento de SLA médico</span>
              <p className="text-xs font-bold text-white mt-1">Treinamento SCHEDULER_EDIT</p>
              <p className="text-[11px] text-white/70 mt-1">Somente 20% das clínicas utilizam o faturamento XML TISS. Agendar webinar focado nas dores das secretárias de saúde.</p>
            </div>
            <div className="bg-white/10 p-4 rounded-xl border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-fixed">Caso 3: Quedas em USER_INVITE_COUNT</span>
              <p className="text-xs font-bold text-white mt-1">Liberação de Espaços Globais</p>
              <p className="text-[11px] text-white/70 mt-1">Identificamos baixa ocupação de licenças em planos Enterprise. Liberar onboarding assistido por CS.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setAiReportOpen(false)}
              className="px-4 py-2 bg-white text-primary font-bold text-xs rounded-lg hover:bg-white/90 transition-all"
            >
              Ciente das Recomendações
            </button>
            <button className="px-4 py-2 bg-primary text-white border border-white/20 font-bold text-xs rounded-lg flex items-center gap-1.5 hover:bg-primary-container-high transition-all">
              <ExternalLink className="w-3.5 h-3.5" />
              Ver Relatório Completo
            </button>
          </div>
        </div>
      )}

      {/* Top Highlights blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Top adopted */}
        <div className="bg-white border border-outline-variant p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 text-secondary leading-tight flex items-center gap-1">
            <Percent className="w-4 h-4" />
            Top Recursos Utilizados
          </h3>
          <div className="space-y-4">
            {topAdopted.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-on-surface truncate">{item.nomeAmigavel}</span>
                    <span className="text-on-surface-variant">{item.percentAdoption}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                    <div className="bg-secondary h-full rounded-full" style={{ width: `${item.percentAdoption}%` }}></div>
                  </div>
                </div>
                <span className="text-[9px] font-bold bg-surface-container px-2 py-0.5 rounded-md text-on-surface-variant uppercase">
                  {item.produto === "Ambos" ? "GLOBAL" : item.produto}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk of abandon / low adopted */}
        <div className="bg-white border border-outline-variant p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 text-error leading-tight flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Risco de Abandono (Uso Crítico &lt;35%)
          </h3>
          <div className="space-y-4">
            {lowestAdopted.length === 0 ? (
              <p className="text-xs text-on-surface-variant font-medium py-10 text-center">Nenhum recurso com adoção menor que 35% registrado!</p>
            ) : (
              lowestAdopted.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between items-center text-xs font-bold mb-1">
                      <span className="text-on-surface truncate">{item.nomeAmigavel}</span>
                      <span className="text-on-surface-variant">{item.percentAdoption}%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                      <div className="bg-error h-full rounded-full" style={{ width: `${item.percentAdoption}%` }}></div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold bg-surface-container px-2 py-0.5 rounded-md text-on-surface-variant uppercase">
                    {item.produto === "Ambos" ? "GLOBAL" : item.produto}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Interactive feature filter controls bar */}
      <div className="bg-surface-container-low p-4 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-4 border border-outline-variant/60">
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Módulos:</label>
          <div className="flex bg-surface-container-highest p-0.5 rounded-lg border border-outline-variant/50 shadow-sm">
            {(["Geral", "QuarkRH", "QuarkClinic"] as const).map((prod) => (
              <button
                key={prod}
                onClick={() => setProductFilter(prod)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  productFilter === prod
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-white/40"
                }`}
              >
                {prod}
              </button>
            ))}
          </div>
        </div>

        {/* Search input specifically for Variables */}
        <div className="relative w-full sm:w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar variável técnica..."
            className="w-full bg-white border border-outline-variant/50 pr-4 pl-9 py-1.5 rounded-lg text-xs font-semibold outline-none focus:border-primary shadow-sm"
          />
        </div>
      </div>

      {/* Large table list of variables */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] uppercase tracking-wider font-bold">
                <th className="px-6 py-4 text-on-surface-variant">Mapeador Técnico / Código</th>
                <th className="px-6 py-4 text-on-surface-variant">Nome Amigável / Descrição</th>
                <th className="px-6 py-4 text-on-surface-variant">Produto Original</th>
                <th className="px-6 py-4 text-on-surface-variant">Taxa de Adoção Geral</th>
                <th className="px-6 py-4 text-on-surface-variant">Impacto em Churn</th>
                <th className="px-6 py-4 text-on-surface-variant text-right">Contas Ativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {filteredAnalysis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant font-medium">
                    Nenhum parâmetro de telemetria encontrado com esses filtros.
                  </td>
                </tr>
              ) : (
                filteredAnalysis.map((item, idx) => {
                  let badgeColor = "bg-secondary-container/20 text-secondary";
                  if (item.impactoChurn === "Muito Alto" || item.impactoChurn === "Alto") {
                    badgeColor = "bg-error-container/30 text-error";
                  } else if (item.impactoChurn === "Médio") {
                    badgeColor = "bg-amber-100 text-amber-800";
                  }

                  return (
                    <tr key={idx} className="hover:bg-surface-container-low/20 transition-all font-medium">
                      {/* Code identifier */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-primary font-bold bg-primary-container/20 px-2 py-1 rounded-md">
                          {item.codigo}
                        </span>
                        <div className="text-[10px] text-on-surface-variant uppercase font-semibold mt-1.5">{item.categoria}</div>
                      </td>

                      {/* Decoded user tags */}
                      <td className="px-6 py-4 max-w-sm">
                        <p className="text-xs font-bold text-on-surface leading-tight">{item.nomeAmigavel}</p>
                        <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">{item.descricao}</p>
                      </td>

                      {/* Product Scope */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-on-surface">
                          {item.produto === "Ambos" ? "Duplo" : item.produto}
                        </span>
                      </td>

                      {/* Progress bar graph */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-surface-container rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                item.percentAdoption >= 70 
                                  ? "bg-secondary" 
                                  : item.percentAdoption >= 35 
                                  ? "bg-amber-500" 
                                  : "bg-error"
                              }`}
                              style={{ width: `${item.percentAdoption}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-on-surface">{item.percentAdoption}%</span>
                        </div>
                      </td>

                      {/* Churn correlation badge */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${badgeColor}`}>
                          {item.impactoChurn}
                        </span>
                      </td>

                      {/* Active count in base */}
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-bold text-on-surface block">
                          {item.activeClientsCount} {item.activeClientsCount === 1 ? "conta" : "contas"}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">de {item.totalClientsCount} qualificadas</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
