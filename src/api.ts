const baseUrl = '/quark-customer-success/';

export function apiUrl(path: string): string {
  return `${baseUrl}${path.replace(/^\/+/, '')}`;
}

export const appPath = (path: string): string => `${baseUrl}${path.replace(/^\/+/, '')}`;

export const isImportPath = (): boolean =>
  window.location.pathname === appPath('configuracoes/importar');
