/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cliente, AtividadeCSV, VariavelCSV } from "./types";

// The calculation template anchor date: 2026-06-16
export const REFERENCE_DATE = "2026-06-16";

// Helpers to compute dates relative to reference
export function getDaysDiff(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function formatDateRelativeToRef(daysAgo: number): string {
  const ref = new Date(REFERENCE_DATE);
  ref.setDate(ref.getDate() - daysAgo);
  return ref.toISOString().split("T")[0];
}

/// Complete realistic default variables dataset matching the prototypes (concise set)
export const DEFAULT_VARIAVEIS: VariavelCSV[] = [
  {
    id: "QX-10293",
    codigo: "QuarkRH",
    nome_cliente: "Tech Horizon Ltda",
    plano: "Enterprise Plan",
    mrr: 4500,
    variavel_codigo: "LOGIN_FREQ,FEAT_DASH_CLICK,USER_INVITE_COUNT,REPORTS_EXP_PDF,USER_ROLE_CONFIG",
    total_variaveis: 10
  },
  {
    id: "QC-90112",
    codigo: "QuarkClinic",
    nome_cliente: "Hosp. Municipal Sul",
    plano: "Gov Bundle",
    mrr: 12800,
    variavel_codigo: "LOGIN_FREQ,FEAT_DASH_CLICK,REPORTS_EXP_PDF,SCHEDULER_EDIT,PATIENT_INSPECT",
    total_variaveis: 15
  },
  {
    id: "QX-10556",
    codigo: "QuarkRH",
    nome_cliente: "LogiMove Solutions",
    plano: "Standard Plan",
    mrr: 2100,
    variavel_codigo: "LOGIN_FREQ,FEAT_DASH_CLICK",
    total_variaveis: 8
  },
  {
    id: "QC-99882",
    codigo: "QuarkClinic",
    nome_cliente: "Inova Health Group",
    plano: "Professional Plan",
    mrr: 4800,
    variavel_codigo: "LOGIN_FREQ,FEAT_DASH_CLICK,REPORTS_EXP_PDF",
    total_variaveis: 12
  },
  {
    id: "QX-91113",
    codigo: "QuarkClinic",
    nome_cliente: "Zenith MedTech",
    plano: "Enterprise + VIP",
    mrr: 15500,
    variavel_codigo: "LOGIN_FREQ",
    total_variaveis: 20
  }
];

// Complete realistic default activities dataset matching the relative times (concise set)
export const DEFAULT_ATIVIDADES: AtividadeCSV[] = [
  // Tech Horizon Ltda (Today, high activity, low risk)
  { cliente_id: "QX-10293", produto: "QuarkRH", data: formatDateRelativeToRef(0), requisicoes: 1420, usuarios_ativos: 8, usuarios_totais: 10 },
  { cliente_id: "QX-10293", produto: "QuarkRH", data: formatDateRelativeToRef(7), requisicoes: 1450, usuarios_ativos: 8, usuarios_totais: 10 },
  
  // Hosp. Municipal Sul (Yesterday, medium risk)
  { cliente_id: "QC-90112", produto: "QuarkClinic", data: formatDateRelativeToRef(1), requisicoes: 4150, usuarios_ativos: 6, usuarios_totais: 10 },
  { cliente_id: "QC-90112", produto: "QuarkClinic", data: formatDateRelativeToRef(8), requisicoes: 4400, usuarios_ativos: 6, usuarios_totais: 10 },
  
  // LogiMove Solutions (3 days ago, extreme drop -35%)
  { cliente_id: "QX-10556", produto: "QuarkRH", data: formatDateRelativeToRef(3), requisicoes: 120, usuarios_ativos: 1, usuarios_totais: 8 },
  { cliente_id: "QX-10556", produto: "QuarkRH", data: formatDateRelativeToRef(10), requisicoes: 185, usuarios_ativos: 2, usuarios_totais: 8 },
  
  // Inova Health Group (Yesterday, drop of exactly 30%)
  { cliente_id: "QC-99882", produto: "QuarkClinic", data: formatDateRelativeToRef(1), requisicoes: 420, usuarios_ativos: 3, usuarios_totais: 10 },
  { cliente_id: "QC-99882", produto: "QuarkClinic", data: formatDateRelativeToRef(8), requisicoes: 600, usuarios_ativos: 4, usuarios_totais: 10 },

  // Zenith MedTech (Today, active users = 1 triggers alert)
  { cliente_id: "QX-91113", produto: "QuarkClinic", data: formatDateRelativeToRef(0), requisicoes: 95, usuarios_ativos: 1, usuarios_totais: 15 },
  { cliente_id: "QX-91113", produto: "QuarkClinic", data: formatDateRelativeToRef(7), requisicoes: 110, usuarios_ativos: 2, usuarios_totais: 15 }
];

/**
 * Calculations required:
 * 
 * 1. Dias sem uso: reference_date - latest activity date
 * 
 * 2. Engajamento: total_requisicoes / total_usuarios (mapped to latest activity record)
 * 
 * 3. Adoção: variables_used.length / total_variables_available
 * 
 * 4. Health Score:
 *    40% = dias desde última atividade
 *    30% = variação de requisições
 *    20% = usuários ativos (active ratio)
 *    10% = quantidade de variáveis utilizadas (adoption ratio)
 * 
 * Classificação:
 *    80 to 100 = Saudável
 *    60 to 79 = Atenção
 *    Below 60 = Risco
 * 
 * Automatic alerts count:
 *  - Sem atividade há mais de 7 dias
 *  - Queda de uso acima de 30%
 *  - Apenas 1 usuário ativo
 *  - Zero usuários ativos
 *  - Health Score abaixo de 50
 */
export function calcularMétricasEHealthScore(
  atividades: AtividadeCSV[],
  variaveis: VariavelCSV[]
): Cliente[] {
  if (!Array.isArray(variaveis)) {
    console.warn("calcularMétricasEHealthScore: array de variáves inválido. Fornecendo fallback vazio.");
    return [];
  }
  const safeAtividades = Array.isArray(atividades) ? atividades : [];

  return variaveis.map((v) => {
    try {
      // Filter activities for this client & product
      const clientAct = safeAtividades.filter(
        (a) => (a?.cliente_id || "").trim() === (v?.id || "").trim() && 
               (a?.produto || "").trim().toLowerCase() === (v?.codigo || "").trim().toLowerCase()
      );

      // Latest activity
      let latestAct: AtividadeCSV | undefined;
      let prevAct: AtividadeCSV | undefined;

      if (clientAct.length > 0) {
        // Sort activities descending by date
        const sorted = [...clientAct].sort((a, b) => {
          const tA = a && a.data ? new Date(a.data).getTime() : 0;
          const tB = b && b.data ? new Date(b.data).getTime() : 0;
          const valA = isNaN(tA) ? 0 : tA;
          const valB = isNaN(tB) ? 0 : tB;
          return valB - valA;
        });
        latestAct = sorted[0];
        prevAct = sorted[1];
      }

      const variables_used = v?.variavel_codigo
        ? String(v.variavel_codigo).split(",").map((s) => s.trim()).filter((s) => s.length > 0)
        : [];

      const total_vars = typeof v?.total_variaveis === "number" ? v.total_variaveis : 10;
      const safe_total_vars = total_vars > 0 ? total_vars : 10;
      const adocao_ratio = variables_used.length / safe_total_vars;

      let dias_sem_uso = 30; // default if no activity is logged
      let u_ativos = 0;
      let u_totais = 100;
      let req_atual = 0;
      let req_anterior = 0;
      let ultima_data = "Sem data";

      if (latestAct) {
        ultima_data = latestAct.data || "Sem data";
        const refTime = new Date(REFERENCE_DATE).getTime();
        const actTime = latestAct.data ? new Date(latestAct.data).getTime() : NaN;
        
        if (!isNaN(refTime) && !isNaN(actTime)) {
          // Round to prevent decimal days
          dias_sem_uso = Math.round((refTime - actTime) / (1000 * 60 * 60 * 24));
          if (!isFinite(dias_sem_uso) || isNaN(dias_sem_uso) || dias_sem_uso < 0) {
            dias_sem_uso = 0;
          }
        } else {
          dias_sem_uso = 30;
        }

        u_ativos = typeof latestAct.usuarios_ativos === "number" ? latestAct.usuarios_ativos : 0;
        u_totais = typeof latestAct.usuarios_totais === "number" && latestAct.usuarios_totais > 0 ? latestAct.usuarios_totais : 100;
        req_atual = typeof latestAct.requisicoes === "number" ? latestAct.requisicoes : 0;
      }

      if (prevAct) {
        req_anterior = typeof prevAct.requisicoes === "number" ? prevAct.requisicoes : 0;
      } else {
        req_anterior = req_atual;
      }

      // Variação percentual
      let variacao_requisicoes = 0;
      if (req_anterior > 0) {
        variacao_requisicoes = (req_atual - req_anterior) / req_anterior;
      }
      if (isNaN(variacao_requisicoes) || !isFinite(variacao_requisicoes)) {
        variacao_requisicoes = 0;
      }

      const safe_u_totais = u_totais > 0 ? u_totais : 100;
      const u_ativos_ratio = u_ativos / safe_u_totais;

      // 1. Component Days (40%): 
      // If dias_sem_uso is 0 -> 100 points. If >= 15 -> 0 points.
      let f_dias = Math.max(0, 100 - (dias_sem_uso * 6.66));
      if (isNaN(f_dias) || !isFinite(f_dias)) f_dias = 0;

      // 2. Component Variation (30%)
      let f_variacao = variacao_requisicoes >= 0
        ? 100
        : Math.max(0, 100 + (variacao_requisicoes * 100));
      if (isNaN(f_variacao) || !isFinite(f_variacao)) f_variacao = 0;

      // 3. Component Active Users (20%)
      let f_usuarios = u_ativos_ratio * 100;
      if (isNaN(f_usuarios) || !isFinite(f_usuarios)) f_usuarios = 0;

      // 4. Component Variables Used (10%)
      let f_variaveis = adocao_ratio * 100;
      if (isNaN(f_variaveis) || !isFinite(f_variaveis)) f_variaveis = 0;

      // Compute Health score with specific weights:
      let health_score = Math.round(
        (f_dias * 0.4) +
        (f_variacao * 0.3) +
        (f_usuarios * 0.2) +
        (f_variaveis * 0.1)
      );
      if (isNaN(health_score) || !isFinite(health_score)) {
        health_score = 50;
      }

      // Classificação
      let classificacao: "Saudável" | "Atenção" | "Risco" = "Atenção";
      if (health_score >= 80) {
        classificacao = "Saudável";
      } else if (health_score < 60) {
        classificacao = "Risco";
      }

      // Set alerts automatically according to the specs
      const alertas_ativos: Cliente["alertas_ativos"] = [];

      // Trigger 1: Sem atividade há mais de 7 dias
      if (dias_sem_uso > 7) {
        alertas_ativos.push({
          tipo: "Sem atividade há mais de 7 dias",
          severidade: "Crítico",
          data_alerta: ultima_data,
          resolvido: false
        });
      }

      // Trigger 2: Queda de uso acima de 30%
      if (variacao_requisicoes <= -0.30) {
        alertas_ativos.push({
          tipo: "Queda de uso acima de 30%",
          severidade: "Crítico",
          data_alerta: ultima_data,
          resolvido: false
        });
      }

      // Trigger 3: Apenas 1 usuário ativo
      if (u_ativos === 1) {
        alertas_ativos.push({
          tipo: "Apenas 1 usuário ativo",
          severidade: "Atenção",
          data_alerta: ultima_data,
          resolvido: false
        });
      }

      // Trigger 4: Zero usuários ativos
      if (u_ativos === 0) {
        alertas_ativos.push({
          tipo: "Zero usuários ativos",
          severidade: "Crítico",
          data_alerta: ultima_data,
          resolvido: false
        });
      }

      // Trigger 5: Health Score abaixo de 50
      if (health_score < 50) {
        alertas_ativos.push({
          tipo: "Health Score abaixo de 50",
          severidade: health_score < 40 ? "Crítico" : "Atenção",
          data_alerta: ultima_data,
          resolvido: false
        });
      }


      return {
        id: v?.id || "unknown",
        nome: v?.nome_cliente || "Cliente Desconhecido",
        produto: (v?.codigo || "").trim() === "QuarkClinic" ? "QuarkClinic" : "QuarkRH",
        plano: v?.plano || "Enterprise Plan",
        mrr: v?.mrr || 0,
        ultima_atividade: ultima_data,
        dias_sem_uso,
        requisicoes_atual: req_atual,
        requisicoes_anterior: req_anterior,
        variacao_requisicoes,
        usuarios_ativos: u_ativos,
        usuarios_totais: u_totais,
        usuarios_ativos_ratio: u_ativos_ratio,
        variaveis_utilizadas: variables_used,
        total_variaveis_disponiveis: total_vars,
        health_score,
        classificacao,
        alertas_ativos
      };
    } catch (computeErr: any) {
      console.error("Falha ao calcular métricas para o cliente:", v?.id, computeErr);
      return {
        id: v?.id || "unknown",
        nome: v?.nome_cliente || "Cliente Desconhecido",
        produto: (v?.codigo || "").trim() === "QuarkClinic" ? "QuarkClinic" : "QuarkRH",
        plano: v?.plano || "Enterprise Plan",
        mrr: v?.mrr || 0,
        ultima_atividade: "Sem data",
        dias_sem_uso: 30,
        requisicoes_atual: 0,
        requisicoes_anterior: 0,
        variacao_requisicoes: 0,
        usuarios_ativos: 0,
        usuarios_totais: 100,
        usuarios_ativos_ratio: 0,
        variaveis_utilizadas: [],
        total_variaveis_disponiveis: 10,
        health_score: 50,
        classificacao: "Atenção" as const,
        alertas_ativos: []
      };
    }
  });
}

// Generate ready-to-write CSV strings for user copy or template download
export function gerarTemplateCSVAtividades(): string {
  const headers = "cliente_id,produto,data,requisicoes,usuarios_ativos,usuarios_totais\n";
  const rows = DEFAULT_ATIVIDADES.map(
    (a) => `${a.cliente_id},${a.produto},${a.data},${a.requisicoes},${a.usuarios_ativos},${a.usuarios_totais}`
  ).join("\n");
  return headers + rows;
}

export function gerarTemplateCSVVariaveis(): string {
  const headers = "id,codigo,nome_cliente,plano,mrr,variavel_codigo,total_variaveis\n";
  const rows = DEFAULT_VARIAVEIS.map(
    (v) => `"${v.id}","${v.codigo}","${v.nome_cliente}","${v.plano}",${v.mrr},"${v.variavel_codigo}",${v.total_variaveis}`
  ).join("\n");
  return headers + rows;
}

export function detectDelimiter(line: string): string {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

// A simple CSV line parser that respects quotes and custom delimiter
export function parseCSVLine(line: string, delimiter: string = ","): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let currentVal = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(currentVal.trim());
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal.trim());
  return result;
}

export function parseCSVAtividades(text: string): AtividadeCSV[] {
  console.log("Carregamento do CSV iniciado: parseCSVAtividades");
  try {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) {
      console.warn("parseCSVAtividades: Nenhum registro ou somente cabeçalho encontrado.");
      return [];
    }
    
    const delimiter = detectDelimiter(lines[0]);
    const header = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim());
    const idxId = header.findIndex(h => h === "cliente_id" || h.includes("cliente_id") || h === "id" || h.includes("id_cliente"));
    const idxProd = header.findIndex(h => h.includes("produto") || h.includes("codigo") || h === "prod" || h === "produto");
    const idxData = header.findIndex(h => h.includes("data") || h === "date");
    const idxReq = header.findIndex(h => h.includes("requisicoes") || h.includes("req") || h.includes("requisicao") || h.includes("requests"));
    const idxAct = header.findIndex(h => h.includes("usuarios_ativos") || h.includes("ativos") || h.includes("active"));
    const idxTot = header.findIndex(h => h.includes("usuarios_totais") || h.includes("totais") || h.includes("total_usuarios") || h.includes("total"));

    const list: AtividadeCSV[] = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCSVLine(lines[i], delimiter).map(c => c.replace(/^["']|["']$/g, "").trim());
        if (cols.length < 3) continue;

        const cliente_id = cols[idxId !== -1 ? idxId : 0] || "";
        const produto = cols[idxProd !== -1 ? idxProd : 1] || "QuarkRH";
        const data = cols[idxData !== -1 ? idxData : 2] || REFERENCE_DATE;
        const requisicoes = parseInt(cols[idxReq !== -1 ? idxReq : 3] || "0", 10);
        const usuarios_ativos = parseInt(cols[idxAct !== -1 ? idxAct : 4] || "0", 10);
        const usuarios_totais = parseInt(cols[idxTot !== -1 ? idxTot : 5] || "100", 10);

        list.push({
          cliente_id,
          produto,
          data,
          requisicoes,
          usuarios_ativos,
          usuarios_totais
        });
      } catch (lineErr) {
        console.error("Erros de parsing na linha de atividades:", lines[i], lineErr);
      }
    }
    console.log("CSV carregado com sucesso: Atividades.");
    console.log(`Quantidade de registros encontrados (Atividades): ${list.length}`);
    return list;
  } catch (err: any) {
    console.error("Erros de parsing gerais ao processar CSV de Atividades:", err);
    return [];
  }
}

export function parseCSVVariaveis(text: string): VariavelCSV[] {
  console.log("Carregamento do CSV iniciado: parseCSVVariaveis");
  try {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) {
      console.warn("parseCSVVariaveis: Nenhum registro ou somente cabeçalho encontrado.");
      return [];
    }

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim());
    
    const idxId = headers.findIndex(h => h === "id" || h === "cliente_id" || h.includes("id"));
    const idxProd = headers.findIndex(h => h === "codigo" || h === "produto" || h === "prod");
    const idxNome = headers.findIndex(h => h.includes("nome_cliente") || h.includes("cliente") || h.includes("nome"));
    const idxPlano = headers.findIndex(h => h.includes("plano") || h === "plan");
    const idxMrr = headers.findIndex(h => h.includes("mrr") || h.includes("receita"));
    const idxVar = headers.findIndex(h => h.includes("variavel_codigo") || h.includes("variaveis") || h.includes("variavel_codigos"));
    const idxTot = headers.findIndex(h => h.includes("total_variaveis") || h.includes("total") || h.includes("total_vars"));

    const list: VariavelCSV[] = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCSVLine(lines[i], delimiter);
        if (cols.length < 3) continue;

        const id = cols[idxId !== -1 ? idxId : 0] || "";
        const codigo = cols[idxProd !== -1 ? idxProd : 1] || "QuarkRH";
        const nome_cliente = cols[idxNome !== -1 ? idxNome : 2] || "Cliente Importado";
        const plano = cols[idxPlano !== -1 ? idxPlano : 3] || "Enterprise Plan";
        const mrr = parseFloat(cols[idxMrr !== -1 ? idxMrr : 4] || "0");
        const variavel_codigo = cols[idxVar !== -1 ? idxVar : 5] || "";
        const total_variaveis = parseInt(cols[idxTot !== -1 ? idxTot : 6] || "10", 10);

        list.push({
          id,
          codigo,
          nome_cliente,
          plano,
          mrr,
          variavel_codigo,
          total_variaveis
        });
      } catch (lineErr) {
        console.error("Erros de parsing na linha de variáveis:", lines[i], lineErr);
      }
    }
    console.log("CSV carregado com sucesso: Variáveis.");
    console.log(`Quantidade de registros encontrados (Variáveis): ${list.length}`);
    return list;
  } catch (err: any) {
    console.error("Erros de parsing gerais ao processar CSV de Variáveis:", err);
    return [];
  }
}
