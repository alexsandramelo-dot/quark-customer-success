/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Cliente {
  id: string; // e.g. #QX-10293
  nome: string;
  produto: "QuarkRH" | "QuarkClinic";
  plano: string; // e.g. "Enterprise Plan", "Standard Plan"
  mrr: number; // monthly recurring revenue, e.g. 1500
  
  // Dynamic Calculated Metrics
  ultima_atividade: string; // YYYY-MM-DD
  dias_sem_uso: number; // calculated from local reference date (2026-06-16)
  
  requisicoes_atual: number;
  requisicoes_anterior: number;
  variacao_requisicoes: number; // e.g. -0.24 representing -24%
  
  usuarios_ativos: number;
  usuarios_totais: number;
  usuarios_ativos_ratio: number; // usuarios_ativos / usuarios_totais (ratio)
  
  variaveis_utilizadas: string[]; // as strings or list of variable names
  total_variaveis_disponiveis: number;
  
  // Custom generated health scores & segments
  health_score: number; // 0 to 100
  classificacao: "Saudável" | "Atenção" | "Risco";
  
  // Alerts and flags
  alertas_ativos: {
    tipo: string; // e.g. "Sem atividade há mais de 7 dias", "Queda de uso acima de 30%"
    severidade: "Crítico" | "Atenção";
    data_alerta: string;
    resolvido: boolean;
  }[];
}

export interface AtividadeCSV {
  cliente_id: string;
  produto: string; // e.g. QuarkRH or QuarkClinic
  data: string; // YYYY-MM-DD
  requisicoes: number;
  usuarios_ativos: number;
  usuarios_totais: number;
}

export interface VariavelCSV {
  id: string;
  codigo: string; // QuarkRH or QuarkClinic
  nome_cliente: string;
  plano: string;
  mrr: number;
  variavel_codigo: string; // comma-separated variables, e.g. "LOGIN_FREQ, FEAT_DASH_CLICK"
  total_variaveis: number;
}
