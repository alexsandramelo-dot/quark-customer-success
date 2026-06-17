/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AtividadeCSV, VariavelCSV, Cliente } from "../types";
import { parseCSVAtividades, parseCSVVariaveis, gerarTemplateCSVAtividades, gerarTemplateCSVVariaveis } from "../data";
import { Download, UploadCloud, RefreshCw, Plus, CheckCircle, AlertOctagon, HelpCircle } from "lucide-react";

interface SettingsConfigProps {
  onImportAtividades: (data: AtividadeCSV[]) => void;
  onImportVariaveis: (data: VariavelCSV[]) => void;
  onResetDatabase: () => void;
  onAddClientManual: (newC: VariavelCSV, initialAct: AtividadeCSV) => void;
}

export default function SettingsConfig({
  onImportAtividades,
  onImportVariaveis,
  onResetDatabase,
  onAddClientManual,
}: SettingsConfigProps) {
  // CSV Status
  const [atividadesStatus, setAtividadesStatus] = useState<string | null>(null);
  const [variaveisStatus, setVariaveisStatus] = useState<string | null>(null);

  // Manual addition fields
  const [idCliente, setIdCliente] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [produto, setProduto] = useState("QuarkRH");
  const [plano, setPlano] = useState("Enterprise Plan");
  const [mrr, setMrr] = useState("4500");
  const [totVars, setTotVars] = useState("10");
  const [activeVars, setActiveVars] = useState("LOGIN_FREQ,FEAT_DASH_CLICK,REPORTS_EXP_PDF");

  const [initialActReq, setInitialActReq] = useState("1200");
  const [initialActUsers, setInitialActUsers] = useState("80");
  const [initialTotUsers, setInitialTotUsers] = useState("100");

  const [manualStatus, setManualStatus] = useState<string | null>(null);

  // File download execution
  const handleDownloadTemplate = (type: "atividades" | "variaveis") => {
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

  // CSV reading handlers
  const handleAtividadesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSVAtividades(text);
        if (parsed.length === 0) {
          setAtividadesStatus("Erro: Arquivo vazio ou sem colunas compatíveis.");
          return;
        }
        onImportAtividades(parsed);
        setAtividadesStatus(`Sucesso: ${parsed.length} registros de atividades importados!`);
      } catch (err) {
        setAtividadesStatus("Erro ao processar as colunas do CSV.");
      }
    };
    reader.readAsText(file);
  };

  const handleVariaveisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSVVariaveis(text);
        if (parsed.length === 0) {
          setVariaveisStatus("Erro: Arquivo vazio ou sem cabeçalhos de variáveis.");
          return;
        }
        onImportVariaveis(parsed);
        setVariaveisStatus(`Sucesso: ${parsed.length} registros de clientes importados!`);
      } catch (err) {
        setVariaveisStatus("Erro ao ler cabeçalhos.");
      }
    };
    reader.readAsText(file);
  };

  // Handle manual client submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idCliente || !nomeCliente) {
      setManualStatus("Erro: Todos os campos principais são obrigatórios.");
      return;
    }

    const nVariavel: VariavelCSV = {
      id: idCliente.trim().replace(/^#/, ""),
      codigo: produto,
      nome_cliente: nomeCliente,
      plano,
      mrr: parseFloat(mrr) || 0,
      variavel_codigo: activeVars,
      total_variaveis: parseInt(totVars, 10) || 10
    };

    const nAtividade: AtividadeCSV = {
      cliente_id: idCliente.trim().replace(/^#/, ""),
      produto,
      data: new Date().toISOString().split("T")[0],
      requisicoes: parseInt(initialActReq, 10) || 0,
      usuarios_ativos: parseInt(initialActUsers, 10) || 0,
      usuarios_totais: parseInt(initialTotUsers, 10) || 100
    };

    onAddClientManual(nVariavel, nAtividade);
    setManualStatus(`Sucesso: Cliente "${nomeCliente}" adicionado e health score calculado com sucesso!`);
    
    // reset form
    setIdCliente("");
    setNomeCliente("");
    setTimeout(() => setManualStatus(null), 5000);
  };

  return (
    <div id="settings-config-view" className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-on-surface">Configurações & Importação</h2>
        <p className="text-body-md text-on-surface-variant">Gerencie fontes de dados, importe planilhas CSV ou adicione novas contas manualmente.</p>
      </div>

      {/* Database control cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CSV Import area */}
        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-on-surface">Importador de Planilhas CSV</h3>
            <p className="text-xs text-on-surface-variant">Carregue dados transacionais para atualizar instantaneamente o Health Score geral.</p>
          </div>

          {/* Activities block */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-on-surface">
              <span className="flex items-center gap-1.5">
                1. Histórico de Atividades (atividades.csv)
              </span>
              <button 
                type="button"
                onClick={() => handleDownloadTemplate("atividades")}
                className="text-primary hover:underline flex items-center gap-1 text-[11px]"
              >
                <Download className="w-3 h-3" />
                Baixar Modelo
              </button>
            </div>
            
            <div className="border-2 border-dashed border-outline-variant/60 rounded-xl p-4 text-center hover:bg-surface-container-low transition-colors relative flex flex-col items-center justify-center">
              <UploadCloud className="w-8 h-8 text-on-surface-variant mb-2" />
              <p className="text-xs font-bold text-on-surface">Clique para carregar atividades.csv</p>
              <p className="text-[10px] text-on-surface-variant mt-1">Colunas obr.: cliente_id, produto, data, requisicoes, usuarios_ativos, usuarios_totais</p>
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleAtividadesUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            {atividadesStatus && (
              <p className={`text-[11px] font-bold py-1 px-2.5 rounded ${
                atividadesStatus.startsWith("Sucesso") ? "bg-secondary-container/20 text-secondary" : "bg-error-container/20 text-error"
              }`}>
                {atividadesStatus}
              </p>
            )}
          </div>

          {/* Variables block */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-xs font-semibold text-on-surface">
              <span className="flex items-center gap-1.5">
                2. Contas & Variáveis (variaveis.csv)
              </span>
              <button 
                type="button"
                onClick={() => handleDownloadTemplate("variaveis")}
                className="text-primary hover:underline flex items-center gap-1 text-[11px]"
              >
                <Download className="w-3 h-3" />
                Baixar Modelo
              </button>
            </div>
            
            <div className="border-2 border-dashed border-outline-variant/60 rounded-xl p-4 text-center hover:bg-surface-container-low transition-colors relative flex flex-col items-center justify-center">
              <UploadCloud className="w-8 h-8 text-on-surface-variant mb-2" />
              <p className="text-xs font-bold text-on-surface">Clique para carregar variaveis.csv</p>
              <p className="text-[10px] text-on-surface-variant mt-1">Colunas obr.: id, codigo, nome_cliente, plano, mrr, variavel_codigo, total_variaveis</p>
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleVariaveisUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            {variaveisStatus && (
              <p className={`text-[11px] font-bold py-1 px-2.5 rounded ${
                variaveisStatus.startsWith("Sucesso") ? "bg-secondary-container/20 text-secondary" : "bg-error-container/20 text-error"
              }`}>
                {variaveisStatus}
              </p>
            )}
          </div>

          <div className="border-t border-outline-variant/40 pt-4 flex gap-4">
            <button 
              onClick={() => { onResetDatabase(); handleClearStatus(); }}
              className="flex items-center gap-2 text-xs font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition px-4 py-2.5 rounded-lg w-full justify-center"
            >
              <RefreshCw className="w-4 h-4 text-on-surface-variant" />
              Restaurar Dados Originais
            </button>
          </div>
        </div>

        {/* Manual form adding */}
        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-bold text-on-surface">Adicionar Cliente Manualmente</h3>
            <p className="text-xs text-on-surface-variant">Cadastre um novo contrato na carteira e calcule seu score telemetria de forma instantânea.</p>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">ID Contrato *</label>
                <input 
                  type="text" 
                  value={idCliente}
                  onChange={(e) => setIdCliente(e.target.value)}
                  placeholder="EX: QX-55422"
                  className="w-full bg-surface-container text-xs font-semibold p-2 rounded-lg border border-outline-variant/40 outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">Nome Fantasia *</label>
                <input 
                  type="text" 
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="EX: Solar Marketing S.A."
                  className="w-full bg-surface-container text-xs font-semibold p-2 rounded-lg border border-outline-variant/40 outline-none focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">Produto</label>
                <select 
                  value={produto}
                  onChange={(e) => setProduto(e.target.value)}
                  className="w-full bg-surface-container text-xs font-semibold p-2 rounded-lg border border-outline-variant/40 outline-none"
                >
                  <option value="QuarkRH">QuarkRH</option>
                  <option value="QuarkClinic">QuarkClinic</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">Plano Comercial</label>
                <input 
                  type="text" 
                  value={plano}
                  onChange={(e) => setPlano(e.target.value)}
                  placeholder="Enterprise"
                  className="w-full bg-surface-container text-xs font-semibold p-2 rounded-lg border border-outline-variant/40 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase block mb-1">MRR Mensal (R$)</label>
                <input 
                  type="number" 
                  value={mrr}
                  onChange={(e) => setMrr(e.target.value)}
                  placeholder="4500"
                  className="w-full bg-surface-container text-xs font-semibold p-2 rounded-lg border border-outline-variant/40 outline-none"
                />
              </div>
            </div>

            <div className="border-t border-outline-variant/30 pt-3">
              <span className="text-[11px] font-bold text-primary block mb-2">Telemetria de Atividades Inicial (Uso Real)</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Requisições Solicitadas</label>
                  <input 
                    type="number" 
                    value={initialActReq}
                    onChange={(e) => setInitialActReq(e.target.value)}
                    placeholder="2500"
                    className="w-full bg-surface-container text-xs p-2 rounded-lg border border-outline-variant/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Usuários Ativos</label>
                  <input 
                    type="number" 
                    value={initialActUsers}
                    onChange={(e) => setInitialActUsers(e.target.value)}
                    placeholder="45"
                    className="w-full bg-surface-container text-xs p-2 rounded-lg border border-outline-variant/40 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Usuários Totais</label>
                  <input 
                    type="number" 
                    value={initialTotUsers}
                    onChange={(e) => setInitialTotUsers(e.target.value)}
                    placeholder="50"
                    className="w-full bg-surface-container text-xs p-2 rounded-lg border border-outline-variant/40 outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant block mb-1 uppercase">
                Variáveis Ativas (Código separados por vírgula)
              </label>
              <input 
                type="text" 
                value={activeVars}
                onChange={(e) => setActiveVars(e.target.value)}
                placeholder="LOGIN_FREQ,FEAT_DASH_CLICK,USER_INVITE_COUNT"
                className="w-full bg-surface-container font-mono text-[10px] p-2 rounded-lg border border-outline-variant/40 outline-none"
              />
              <span className="text-[9px] text-on-surface-variant mt-1.5 block leading-tight">
                Sugestões: LOGIN_FREQ, FEAT_DASH_CLICK, REPORTS_EXP_PDF, USER_INVITE_COUNT, PATIENT_INSPECT, SCHEDULER_EDIT
              </span>
            </div>

            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-2.5 rounded-lg text-xs hover:opacity-90 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Salvar Contrato na Carteira
            </button>

            {manualStatus && (
              <p className={`text-[11px] font-bold p-2.5 rounded ${
                manualStatus.startsWith("Sucesso") ? "bg-secondary-container/20 text-secondary" : "bg-error-container/20 text-error"
              }`}>
                {manualStatus}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* Helper tips and relationship info */}
      <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant/60 flex gap-4">
        <HelpCircle className="w-6 h-6 text-on-surface-variant flex-shrink-0" />
        <div className="text-xs">
          <h4 className="font-bold text-on-surface mb-1">Relacionamento de telemetria Quark</h4>
          <p className="text-on-surface-variant leading-relaxed mb-2">
            A aplicação sincroniza automaticamente as planilhas cruzando os IDs do cliente: 
            <code className="bg-white px-1.5 py-0.5 rounded text-[11px] font-mono border mx-1">atividades.cliente_id = variaveis.id</code> 
            e chave legada de produto: 
            <code className="bg-white px-1.5 py-0.5 rounded text-[11px] font-mono border mx-1">atividades.produto = variaveis.codigo</code>.
          </p>
          <p className="text-on-surface-variant leading-relaxed">
            Se você carregar uma planilha, todas as médias ponderadas e segmentações de saúde serão rascunhadas na hora. Experimente baixar o arquivo modelo e preencher seus próprios dados!
          </p>
        </div>
      </div>
    </div>
  );

  function handleClearStatus() {
    setAtividadesStatus(null);
    setVariaveisStatus(null);
  }
}
