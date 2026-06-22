/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Cliente } from "../types";
import { ChevronRight, CloudDownload, UserPlus, Search, ArrowDown, ArrowUp, Equal, MoreVertical, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";

interface ClientsInRiskProps {
  clientes: Cliente[];
  onNavigate: (view: string, clientId?: string) => void;
  onAddClient: () => void;
  onExportList: () => void;
  selectedProduct: string;
  setSelectedProduct: (product: string) => void;
  searchFilter: string;
  setSearchFilter: (search: string) => void;
}

export default function ClientsInRisk({
  clientes,
  onNavigate,
  onAddClient,
  onExportList,
  selectedProduct,
  setSelectedProduct,
  searchFilter,
  setSearchFilter,
}: ClientsInRiskProps) {
  // Local active filters
  const [riskFilter, setRiskFilter] = useState<string>("Qualquer Risco");
  const [healthRangeFilter, setHealthRangeFilter] = useState<string>("Todos"); // "Todos", "Excelente", "Atenção", "Crítico"

  // Base metrics for Client Management
  const totalInBase = listAllMatching(clientes, "Geral", "Qualquer Risco", "Todos", "").length;
  const avgHealthInBase = Math.round(
    clientes.reduce((sum, c) => sum + c.health_score, 0) / (clientes.length || 1)
  );
  const riskInBase = clientes.filter((c) => c.health_score < 60).length;
  const mrrInRiscoInBase = clientes
    .filter((c) => c.health_score < 50)
    .reduce((sum, c) => sum + c.mrr, 0);

  // Filter evaluation helper
  function listAllMatching(
    list: Cliente[],
    prod: string,
    risk: string,
    healthRange: string,
    search: string
  ): Cliente[] {
    return list.filter((c) => {
      // 1. Product tab
      if (prod !== "Geral" && c.produto !== prod) return false;

      // 2. Risk filter
      // "Alta Probabilidade" => health < 50, "Média Probabilidade" => health >= 50 && health < 70, "Baixa Probabilidade" => health >= 70
      if (risk === "Alta Probabilidade" && c.health_score >= 50) return false;
      if (risk === "Média Probabilidade" && (c.health_score < 50 || c.health_score >= 80)) return false;
      if (risk === "Baixa Probabilidade" && c.health_score < 80) return false;

      // 3. Health Score range filter
      if (healthRange === "Excelente" && c.health_score < 80) return false;
      if (healthRange === "Atenção" && (c.health_score < 50 || c.health_score >= 80)) return false;
      if (healthRange === "Crítico" && c.health_score >= 50) return false;

      // 4. Search query (matches client name or ID)
      if (search.trim().length > 0) {
        const query = search.toLowerCase();
        const nomeMatch = c.nome.toLowerCase().includes(query);
        const idMatch = c.id.toLowerCase().includes(query);
        const prodMatch = c.produto.toLowerCase().includes(query);
        if (!nomeMatch && !idMatch && !prodMatch) return false;
      }

      return true;
    });
  }

  // Get matching filtered clients
  const finalFilteredList = listAllMatching(
    clientes,
    selectedProduct,
    riskFilter,
    healthRangeFilter,
    searchFilter
  );

  // Pagination setups (standard 10 items)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;
  const totalEntries = finalFilteredList.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedList = finalFilteredList.slice(startIndex, startIndex + itemsPerPage);

  const handleClearFilters = () => {
    setSelectedProduct("Geral");
    setRiskFilter("Qualquer Risco");
    setHealthRangeFilter("Todos");
    setSearchFilter("");
    setCurrentPage(1);
  };

  return (
    <div id="clients-in-risk-view">
      {/* Dynamic Nav Breadcrumbs */}
      <div className="flex justify-between items-end mb-8 gap-4 flex-wrap">
        <div>
          <nav className="text-xs font-semibold text-on-surface-variant flex items-center gap-1 mb-2">
            <span>Clientes</span>
            <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
            <span className="text-primary text-[10px] tracking-wider font-bold">LISTA DE CONTAS ATIVAS</span>
          </nav>
          <h2 className="text-3xl font-bold text-on-surface">Gestão de Carteira</h2>
          <p className="text-body-md text-on-surface-variant">Acompanhe a saúde e o engajamento da sua base de clientes em tempo real.</p>
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={onExportList}
            className="flex items-center gap-2 bg-white border border-outline-variant px-4 py-2 rounded-lg text-on-surface hover:bg-surface-container transition-colors text-xs font-semibold shadow-sm"
          >
            <CloudDownload className="w-4 h-4 text-on-surface-variant" />
            Exportar Lista
          </button>
          <button 
            onClick={onAddClient}
            className="flex items-center gap-2 bg-primary text-white hover:opacity-90 transition-opacity px-4 py-2 rounded-lg text-xs font-semibold shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Dynamic Filter metrics bar summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 mb-8 bg-white border border-outline-variant rounded-xl shadow-sm">
        <div>
          <p className="text-xs font-semibold text-on-surface-variant mb-1">Total de Clientes</p>
          <p className="text-2xl font-bold text-primary">{totalInBase}</p>
        </div>
        <div className="hidden md:block w-px bg-outline-variant h-full self-stretch"></div>
        <div>
          <p className="text-xs font-semibold text-on-surface-variant mb-1">Health Score Médio</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-secondary">{avgHealthInBase}</p>
            <span className="text-[10px] font-bold text-secondary bg-secondary-container/20 px-2.5 py-0.5 rounded-full">+4.2%</span>
          </div>
        </div>
        <div className="hidden md:block w-px bg-outline-variant h-full self-stretch"></div>
        <div>
          <p className="text-xs font-semibold text-on-surface-variant mb-1">Contas em Risco</p>
          <p className="text-2xl font-bold text-error">{riskInBase}</p>
        </div>
        <div className="hidden md:block w-px bg-outline-variant h-full self-stretch"></div>
        <div>
          <p className="text-xs font-semibold text-on-surface-variant mb-1">Churn Previsto (MRR)</p>
          <p className="text-2xl font-bold text-on-surface">R$ {(mrrInRiscoInBase / 1000).toFixed(1)}k</p>
        </div>
      </div>

      {/* Filtering Row */}
      <div className="flex flex-col gap-4 mb-6 bg-white border border-outline-variant/60 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* SEARCH BAR WITHIN PAGE */}
          <div className="flex flex-col gap-1.5 col-span-1 md:col-span-1">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Busca Rápida</span>
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text"
                value={searchFilter}
                onChange={(e) => { setSearchFilter(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-1.5 bg-surface-container rounded-lg border border-outline-variant/40 focus:ring-1 focus:ring-primary outline-none text-xs font-medium"
                placeholder="Nome, ID ou Produto..."
              />
            </div>
          </div>

          {/* PRODUCT SELECTOR */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Produto</span>
            <select 
              value={selectedProduct}
              onChange={(e) => { setSelectedProduct(e.target.value); setCurrentPage(1); }}
              className="bg-surface-container border border-outline-variant/40 text-xs font-semibold rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="Geral">Todos os Produtos</option>
              <option value="QuarkRH">QuarkRH</option>
              <option value="QuarkClinic">QuarkClinic</option>
            </select>
          </div>

          {/* RISK SELECTOR */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Faixa de Risco</span>
            <select 
              value={riskFilter}
              onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1); }}
              className="bg-surface-container border border-outline-variant/40 text-xs font-semibold rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="Qualquer Risco">Qualquer Risco</option>
              <option value="Alta Probabilidade">Alta Probabilidade (&lt;50)</option>
              <option value="Média Probabilidade">Média Probabilidade (50-79)</option>
              <option value="Baixa Probabilidade">Baixa Probabilidade (80+)</option>
            </select>
          </div>

          {/* HEALTH SEGMENT SECTOR */}
          <div className="flex flex-col gap-1.5 md:col-span-3 xl:col-span-1">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Seguimento Saúde</span>
            <div className="flex gap-1 flex-wrap">
              {(["Todos", "Excelente", "Atenção", "Crítico"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => { setHealthRangeFilter(r); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                    healthRangeFilter === r
                      ? "bg-secondary-container/20 text-secondary border-secondary"
                      : "bg-surface-container text-on-surface-variant border-transparent hover:border-outline-variant"
                  }`}
                >
                  {r === "Todos" ? "Todos" : r === "Excelente" ? "Excelente (80-100)" : r === "Atenção" ? "Atenção (50-79)" : "Crítico (0-49)"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action tags bottom */}
        <div className="flex justify-between items-center pt-2 border-t border-outline-variant/30 text-xs">
          <span className="text-on-surface-variant font-medium">
            Filtrando <strong className="text-on-surface">{finalFilteredList.length}</strong> de um total de {clientes.length} contas
          </span>
          <button 
            onClick={handleClearFilters}
            className="text-primary hover:underline font-bold text-xs"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Main Grid Table Card */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant uppercase">
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Nome do Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">ID (Nº Contrato)</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Produto</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Última Atividade</th>
                <th className="px-5 py-4 text-xs font-semibold text-on-surface-variant">Usuários Ativos Ratio</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Health Score</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant">Risco de Churn</th>
                <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant font-medium">
                    Nenhum cliente registrado correspondente aos filtros estabelecidos.
                    <br />
                    <button 
                      onClick={handleClearFilters}
                      className="text-primary hover:underline mt-2 font-bold"
                    >
                      Limpar Filtros ativos
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedList.map((c) => {
                  const initials = c.nome
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  // Risk categorization & badge calculations
                  let riskTxt = "Baixa";
                  let riskIcon = <ArrowDown className="w-4 h-4 text-secondary" />;
                  let riskColor = "text-secondary";

                  if (c.health_score < 50) {
                    riskTxt = "Alta";
                    riskIcon = <ArrowUp className="w-4 h-4 text-error" />;
                    riskColor = "text-error font-bold";
                  } else if (c.health_score < 80) {
                    riskTxt = "Média";
                    riskIcon = <Equal className="w-4 h-4 text-amber-500" />;
                    riskColor = "text-amber-600";
                  }

                  // Active users formatting
                  const activeRatioPct = Math.round(c.usuarios_ativos_ratio * 100);

                  return (
                    <tr 
                      key={c.id} 
                      onClick={() => onNavigate("ClienteProfile", c.id)}
                      className="hover:bg-surface-container-high/60 transition-colors group cursor-pointer"
                    >
                      {/* Name & Avatar */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-[10px] ${
                            c.health_score >= 80 
                              ? "bg-secondary-container text-on-secondary-container" 
                              : c.health_score >= 60 
                              ? "bg-amber-100 text-amber-800"
                              : "bg-error-container text-on-error-container"
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{c.nome}</p>
                            <p className="text-[10px] text-on-surface-variant uppercase">{c.plano}</p>
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="px-6 py-3.5 text-xs text-on-surface-variant font-medium">#{c.id}</td>

                      {/* PRODUCT BADGE */}
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.produto === "QuarkRH" 
                            ? "bg-primary-fixed text-on-primary-fixed" 
                            : "bg-secondary-container text-on-secondary-container"
                        }`}>
                          {c.produto.toUpperCase()}
                        </span>
                      </td>

                      {/* LAST ACTIVITY */}
                      <td className="px-6 py-3.5 text-xs text-on-surface-variant font-medium">
                        {c.dias_sem_uso === 0 
                          ? "Hoje" 
                          : c.dias_sem_uso === 1 
                          ? "Ontem" 
                          : `${c.dias_sem_uso} dias atrás`
                        }
                      </td>

                      {/* ACTIVE USERS RATIO */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-outline-variant/60 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                activeRatioPct >= 70 
                                  ? "bg-secondary" 
                                  : activeRatioPct >= 40 
                                  ? "bg-amber-500" 
                                  : "bg-error"
                              }`}
                              style={{ width: `${activeRatioPct}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-on-surface font-semibold">{activeRatioPct}%</span>
                        </div>
                      </td>

                      {/* HEALTH SCORE */}
                      <td className="px-6 py-3.5">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                          c.health_score >= 80
                            ? "bg-secondary/10 text-secondary border-secondary/20"
                            : c.health_score >= 60
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-error/10 text-error border-error/20"
                        }`}>
                          {c.health_score} - {c.classificacao}
                        </span>
                      </td>

                      {/* CHURN RISK */}
                      <td className="px-6 py-3.5">
                        <span className={`flex items-center gap-1 text-xs font-semibold ${riskColor}`}>
                          {riskIcon}
                          {riskTxt}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-surface-container">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex justify-between items-center">
            <p className="text-xs font-semibold text-on-surface-variant">
              Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, totalEntries)} de {totalEntries} clientes
            </p>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-outline-variant rounded-lg bg-white text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-30 disabled:hover:bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    currentPage === i + 1
                      ? "bg-primary text-white"
                      : "hover:bg-surface-container-high text-on-surface"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-outline-variant rounded-lg bg-white text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-30 disabled:hover:bg-white"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
