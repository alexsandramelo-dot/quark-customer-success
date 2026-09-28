export const planModules = {
  'QuarkRH Premium': ['Departamento Pessoal', 'Benefícios', 'Folha de Pagamento', 'Férias', 'Frequência', 'Assinatura Eletrônica', 'Treinamento e Desenvolvimento', 'Saúde Ocupacional', 'Gestão de EPIs', 'Avaliação e Desempenho', 'Perfil Comportamental', 'Comunicação', 'Pesquisa de Clima', 'Feedbacks', 'Administração', 'Recrutamento e Seleção', 'Portal do Colaborador', 'Portal do Gestor'],
  'QuarkRH Empresarial': ['Departamento Pessoal', 'Benefícios', 'Folha de Pagamento', 'Férias', 'Frequência', 'Assinatura Eletrônica', 'Saúde Ocupacional', 'Gestão de EPIs', 'Avaliação e Desempenho', 'Comunicação', 'Pesquisa de Clima', 'Feedbacks', 'Administração', 'Recrutamento e Seleção', 'Portal do Colaborador', 'Portal do Gestor'],
  'QuarkRH Essencial': ['Departamento Pessoal', 'Benefícios', 'Folha de Pagamento', 'Férias', 'Frequência', 'Saúde Ocupacional', 'Gestão de EPIs', 'Avaliação e Desempenho', 'Comunicação', 'Pesquisa de Clima', 'Feedbacks', 'Administração', 'Recrutamento e Seleção', 'Portal do Colaborador', 'Portal do Gestor'],
  'Frequência Premium': ['Departamento Pessoal', 'Folha de Pagamento', 'Frequência', 'Assinatura Eletrônica', 'Saúde Ocupacional', 'Administração', 'Portal do Colaborador', 'Portal do Gestor'],
  'Frequência Básico': ['Departamento Pessoal', 'Frequência', 'Saúde Ocupacional', 'Administração', 'Portal do Colaborador'],
  'Frequência Plus': ['Departamento Pessoal', 'Frequência', 'Saúde Ocupacional', 'Administração', 'Portal do Colaborador'],
  'Plano Talento': ['Departamento Pessoal', 'Saúde Ocupacional', 'Avaliação de Desempenho', 'Comunicação', 'Pesquisa de Clima', 'Feedbacks', 'Administração', 'Recrutamento e Seleção', 'Portal do Colaborador', 'Portal do Gestor'],
  'Plano Administrativo': ['Departamento Pessoal', 'Benefícios', 'Folha de Pagamento', 'Férias', 'Saúde Ocupacional', 'Gestão de EPIs', 'Administração', 'Portal do Colaborador', 'Portal do Gestor'],
  'Plano Organizacional': ['Departamento Pessoal', 'Benefícios', 'Folha de Pagamento', 'Férias', 'Saúde Ocupacional', 'Gestão de EPIs', 'Avaliação e Desempenho', 'Comunicação', 'Pesquisa de Clima', 'Feedbacks', 'Administração', 'Recrutamento e Seleção', 'Portal do Colaborador', 'Portal do Gestor'],
  'Plano Operacional': ['Departamento Pessoal', 'Benefícios', 'Folha de Pagamento', 'Férias', 'Frequência', 'Saúde Ocupacional', 'Gestão de EPIs', 'Administração', 'Portal do Colaborador', 'Portal do Gestor'],
} as const;

const fold = (value: unknown) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');
const aliases = Object.fromEntries([
  ['premium', 'QuarkRH Premium'], ['quarkrh premium', 'QuarkRH Premium'],
  ['empresarial', 'QuarkRH Empresarial'], ['quarkrh empresarial', 'QuarkRH Empresarial'],
  ['essencial', 'QuarkRH Essencial'], ['quarkrh essencial', 'QuarkRH Essencial'],
  ['frequência premium', 'Frequência Premium'], ['frequencia premium', 'Frequência Premium'],
  ['frequência básico', 'Frequência Básico'], ['frequencia basico', 'Frequência Básico'], ['frequência básico', 'Frequência Básico'],
  ['frequência essencial', 'Frequência Básico'], ['frequencia essencial', 'Frequência Básico'],
  ['frequência plus', 'Frequência Plus'], ['frequencia plus', 'Frequência Plus'],
  ['talento', 'Plano Talento'], ['plano talento', 'Plano Talento'], ['plano talento (rh)', 'Plano Talento'],
  ['administrativo', 'Plano Administrativo'], ['administrativo (dp)', 'Plano Administrativo'], ['plano administrativo', 'Plano Administrativo'],
  ['organizacional', 'Plano Organizacional'], ['organizacional (dp+rh)', 'Plano Organizacional'], ['plano organizacional', 'Plano Organizacional'],
  ['operacional', 'Plano Operacional'], ['operacional (dp+ponto)', 'Plano Operacional'], ['plano operacional', 'Plano Operacional'],
].map(([alias, plan]) => [fold(alias), plan])) as Record<string, keyof typeof planModules>;

export function normalizePlanName(value: unknown) {
  const key = fold(value);
  return aliases[key] ?? null;
}

export function modulesForPlan(value: unknown) {
  const plan = normalizePlanName(value);
  return plan ? [...planModules[plan]] : [];
}

export const fixedPlanNames = Object.keys(planModules) as Array<keyof typeof planModules>;
