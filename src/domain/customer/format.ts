export function formatMrr(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatSignatureDate(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Não informado';
  const text = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return 'Não informado';
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

export function formatProcessedDate(value: string | null | undefined, includeTime = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}
export function formatCsmNames(value: unknown): string {
  let names: unknown[];
  if (Array.isArray(value)) names = value;
  else if (typeof value === 'string' && value.trim()) {
    const text = value.trim();
    if (text.startsWith('[') && text.endsWith(']')) {
      try { const parsed: unknown = JSON.parse(text); names = Array.isArray(parsed) ? parsed : [text.slice(1, -1)]; }
      catch { names = [text.slice(1, -1)]; }
    } else names = [text];
  } else names = [];
  return names.map((name) => String(name ?? '').trim()).filter(Boolean).join(', ') || 'CSM não informado';
}
