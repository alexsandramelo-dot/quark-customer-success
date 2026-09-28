export type HistoricalAlertClassification = 'Estável' | 'Em queda' | 'Atenção' | 'Crítico';
export type HistoricalAlertFilter = 'Todos' | 'Estável' | 'Em queda' | 'Atenção' | 'Crítico';

export type HistoricalAlertMock = {
  id: string;
  customerName: string;
  currentAdoption: number;
  changePp: number;
  readings: number[];
  journey: string;
  signedAt: string;
  plan: string;
  csm: string;
  owner: string;
  email: string;
  phone: string;
  reason: string;
};

// Dados temporários utilizados exclusivamente para homologação visual dos indicadores históricos.
// Não misturar com a API atual, dados processados, arquivos persistidos ou .local-data.
export const historicalPortfolioMock = [
  { label: 'Medição 1', adoption: 72 },
  { label: 'Medição 2', adoption: 74 },
  { label: 'Medição 3', adoption: 75 },
  { label: 'Medição 4', adoption: 73 },
  { label: 'Medição 5', adoption: 70 },
  { label: 'Atual', adoption: 68 },
] as const;

export const largestAdoptionDropsMock = [
  { customerName: 'Empresa Alfa', dropPp: 21 },
  { customerName: 'Grupo Beta', dropPp: 17 },
  { customerName: 'Clínica Gama', dropPp: 14 },
  { customerName: 'Empresa Delta', dropPp: 11 },
  { customerName: 'Grupo Ômega', dropPp: 8 },
] as const;

export const moduleUsageDropsMock = [
  { moduleName: 'Ponto', dropPp: 15 },
  { moduleName: 'Benefícios', dropPp: 12 },
  { moduleName: 'R&S', dropPp: 9 },
  { moduleName: 'Clima', dropPp: 7 },
  { moduleName: 'Portal do Colaborador', dropPp: 4 },
] as const;

export const historicalAlertsMock: HistoricalAlertMock[] = [
  {
    id: 'empresa-alfa', customerName: 'Empresa Alfa', currentAdoption: 61, changePp: -21, readings: [82, 72, 61],
    journey: 'Adoção', signedAt: '10/01/2025', plan: 'Enterprise', csm: 'Camila Nogueira',
    owner: 'Bruna Lima', email: 'bruna.lima@example.test', phone: '(11) 90000-0001',
    reason: 'Queda consecutiva nas duas últimas medições. Ponto e Portal do Colaborador concentram as maiores reduções de uso.',
  },
  {
    id: 'grupo-beta', customerName: 'Grupo Beta', currentAdoption: 68, changePp: -17, readings: [85, 77, 68],
    journey: 'Adoção', signedAt: '21/03/2025', plan: 'Premium', csm: 'Rafael Costa',
    owner: 'Lucas Rocha', email: 'lucas.rocha@example.test', phone: '(21) 90000-0002',
    reason: 'Queda observada nas duas últimas medições. Benefícios e Ponto aparecem entre as maiores variações demonstrativas.',
  },
  {
    id: 'clinica-gama', customerName: 'Clínica Gama', currentAdoption: 69, changePp: -14, readings: [83, 76, 69],
    journey: 'Adoção', signedAt: '15/02/2025', plan: 'Premium', csm: 'Fernanda Santiago',
    owner: 'Mariana Souza', email: 'mariana.souza@example.test', phone: '(84) 99999-0000',
    reason: 'Queda consecutiva nas duas últimas medições. Os módulos Ponto e Benefícios concentram as maiores reduções de uso.',
  },
  {
    id: 'empresa-delta', customerName: 'Empresa Delta', currentAdoption: 72, changePp: -11, readings: [83, 77, 72],
    journey: 'Adoção', signedAt: '08/05/2025', plan: 'Professional', csm: 'Ana Ribeiro',
    owner: 'Felipe Martins', email: 'felipe.martins@example.test', phone: '(31) 90000-0004',
    reason: 'Adoção demonstrativa em queda em relação às medições anteriores. Validar contexto antes de qualquer contato real.',
  },
  {
    id: 'grupo-omega', customerName: 'Grupo Ômega', currentAdoption: 79, changePp: -8, readings: [87, 82, 79],
    journey: 'Adoção', signedAt: '12/06/2025', plan: 'Enterprise', csm: 'João Mendes',
    owner: 'Carla Dias', email: 'carla.dias@example.test', phone: '(41) 90000-0005',
    reason: 'Variação demonstrativa moderada nas últimas medições; acompanhar as próximas observações.',
  },
  {
    id: 'instituto-sigma', customerName: 'Instituto Sigma', currentAdoption: 76, changePp: -4, readings: [80, 78, 76],
    journey: 'Adoção', signedAt: '03/08/2025', plan: 'Starter', csm: 'Marina Alves',
    owner: 'Pedro Melo', email: 'pedro.melo@example.test', phone: '(51) 90000-0006',
    reason: 'Variação pequena neste conjunto demonstrativo, dentro da faixa visual estável do protótipo.',
  },
];

// Faixas somente visuais, provisórias e restritas à homologação deste protótipo.
export function classifyHistoricalDrop(changePp: number): HistoricalAlertClassification {
  if (changePp <= -20) return 'Crítico';
  if (changePp <= -10) return 'Atenção';
  if (changePp <= -5) return 'Em queda';
  return 'Estável';
}

export function filterHistoricalAlerts(filter: HistoricalAlertFilter) {
  if (filter === 'Todos') return historicalAlertsMock;
  return historicalAlertsMock.filter((alert) => classifyHistoricalDrop(alert.changePp) === filter);
}

export function countHistoricalAlerts() {
  return {
    Todos: historicalAlertsMock.length,
    Estável: filterHistoricalAlerts('Estável').length,
    'Em queda': filterHistoricalAlerts('Em queda').length,
    Atenção: filterHistoricalAlerts('Atenção').length,
    Crítico: filterHistoricalAlerts('Crítico').length,
  };
}
