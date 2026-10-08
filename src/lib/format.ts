// Fechas, números y textos en formato local (es-AR): "Hoy, 09:12", "30 nov 2026", "2,4 MB".

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export const DAY_MS = 24 * 60 * 60 * 1000

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Días de calendario entre dos fechas (b - a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function clock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Hoy, 09:12", "Ayer, 18:05", "5 oct, 11:20". */
export function dayTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const diff = daysBetween(d, now)
  if (diff === 0) return `Hoy, ${clock(d)}`
  if (diff === 1) return `Ayer, ${clock(d)}`
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${clock(d)}`
}

/** "30 nov 2026". */
export function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/** "16 de octubre de 2026". */
export function longDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`
}

/** "2 de octubre" (sin año). */
export function dayMonth(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
}

/** "octubre de 2026". */
export function monthYear(d: Date): string {
  return `${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`
}

/** Encabezado de grupo de la lista de actividad: "Hoy, 7 de octubre". */
export function dayLabel(d: Date, now: Date = new Date()): string {
  const base = `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
  const diff = daysBetween(d, now)
  if (diff === 0) return `Hoy, ${base}`
  if (diff === 1) return `Ayer, ${base}`
  return base
}

export function plural(n: number, one: string, other: string): string {
  return n === 1 ? one : other
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas". */
export function ago(iso: string, now: Date = new Date()): string {
  const days = daysBetween(new Date(iso), now)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 14) return `hace ${days} días`
  if (days < 60) return `hace ${Math.floor(days / 7)} semanas`
  return `hace ${Math.floor(days / 30)} meses`
}

/** Días que faltan para una fecha (0 = vence hoy, negativo = ya venció). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return daysBetween(now, new Date(iso))
}

export function fileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`
  const kb = Math.max(1, Math.round(bytes / 1024))
  return `${kb.toLocaleString('es-AR')} KB`
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Máscara de entrada para "dd/mm/aaaa". */
export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean)
  return parts.join('/')
}

/** "dd/mm/aaaa" → "aaaa-mm-dd" o null si no es una fecha real. */
export function parseDateInput(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim())
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null
  return `${yyyy}-${mm}-${dd}`
}

export function isEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim())
}

/** "Mi app nueva" → "mi-app-nueva". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}
