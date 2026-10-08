// Datos que "guarda cada app" (pestaña Datos). Se generan siempre igual: mismo seed, mismas filas.

import type { DataCell, DataColumn, DataTableMeta, DataTablePage } from '../api/types'

interface TableDef {
  key: string
  label: string
  columns: DataColumn[]
  total: number
  row: (i: number) => Record<string, DataCell>
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)]
}

const FIRST = ['Julieta', 'Esteban', 'Valeria', 'Hugo', 'Camila', 'Tomás', 'Lucas', 'Sofía', 'Martina', 'Joaquín', 'Florencia', 'Nicolás', 'Agustina', 'Matías', 'Bianca', 'Ramiro', 'Delfina', 'Gonzalo', 'Micaela', 'Franco', 'Abril', 'Ignacio', 'Renata', 'Facundo']
const LAST = ['Roldán', 'Quiroga', 'Núñez', 'Maidana', 'Ferreyra', 'Acosta', 'Peralta', 'Medina', 'Sosa', 'Benítez', 'Ríos', 'Aguirre', 'Molina', 'Castro', 'Vega', 'Ibarra', 'Luna', 'Cabrera', 'Domínguez', 'Ortiz', 'Silva', 'Paz', 'Herrera', 'Godoy']
const PROS = ['Dr. Martín Giménez', 'Lic. Paula Ledesma', 'Dra. Julieta Sosa', 'Lic. Andrés Prieto'] as const
const OBRAS = ['OSDE', 'Swiss Medical', 'Galeno', 'Medifé', 'PAMI', 'Particular'] as const

const fullName = (r: () => number) => `${pick(r, FIRST)} ${pick(r, LAST)}`
const pad = (n: number) => String(n).padStart(2, '0')
const text = (t: string, extra: Partial<DataCell> = {}): DataCell => ({ text: t, ...extra })

function slotLabel(i: number): string {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const perDay = 18
  base.setDate(base.getDate() + Math.floor(i / perDay))
  const slot = i % perDay
  const hh = 9 + Math.floor(slot / 2)
  const mm = slot % 2 === 0 ? '00' : '30'
  return `${pad(base.getDate())}/${pad(base.getMonth() + 1)} · ${pad(hh)}:${mm}`
}

// ───────────── Turnos del consultorio ─────────────

const FIXED_TURNOS: [string, string, 'ok' | 'warn' | 'neutral'][] = [
  ['Julieta Roldán', PROS[0], 'ok'],
  ['Esteban Quiroga', PROS[0], 'ok'],
  ['Valeria Núñez', PROS[1], 'ok'],
  ['Hugo Maidana', PROS[0], 'warn'],
  ['Camila Ferreyra', PROS[1], 'neutral'],
  ['Tomás Acosta', PROS[1], 'ok'],
]
const ESTADO_TXT = { ok: 'Confirmado', warn: 'Pendiente', neutral: 'Cancelado' } as const

const turnos: TableDef = {
  key: 'turnos',
  label: 'Turnos',
  total: 248,
  columns: [
    { key: 'fecha', label: 'Fecha y hora' },
    { key: 'paciente', label: 'Paciente' },
    { key: 'profesional', label: 'Profesional' },
    { key: 'estado', label: 'Estado' },
  ],
  row: (i) => {
    if (i < FIXED_TURNOS.length) {
      const [paciente, pro, tone] = FIXED_TURNOS[i]
      return { fecha: text(slotLabel(i)), paciente: text(paciente, { bold: true }), profesional: text(pro), estado: text(ESTADO_TXT[tone], { tone }) }
    }
    const r = rng(1000 + i)
    const roll = r()
    const tone = roll < 0.7 ? 'ok' : roll < 0.88 ? 'warn' : 'neutral'
    return { fecha: text(slotLabel(i)), paciente: text(fullName(r), { bold: true }), profesional: text(pick(r, PROS)), estado: text(ESTADO_TXT[tone], { tone }) }
  },
}

const pacientes: TableDef = {
  key: 'pacientes',
  label: 'Pacientes',
  total: 112,
  columns: [
    { key: 'paciente', label: 'Paciente' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'obra', label: 'Obra social' },
    { key: 'visita', label: 'Última visita' },
  ],
  row: (i) => {
    const r = rng(5000 + i)
    const d = new Date()
    d.setDate(d.getDate() - Math.floor(r() * 90))
    return {
      paciente: text(fullName(r), { bold: true }),
      telefono: text(`11 ${4000 + Math.floor(r() * 5999)}-${1000 + Math.floor(r() * 8999)}`),
      obra: text(pick(r, OBRAS)),
      visita: text(`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`),
    }
  },
}

const PROFESIONALES = [
  ['Dr. Martín Giménez', 'Clínica médica', 'MP 48.210', '42'],
  ['Lic. Paula Ledesma', 'Psicología', 'MP 31.775', '36'],
  ['Dra. Julieta Sosa', 'Dermatología', 'MP 52.094', '28'],
  ['Lic. Andrés Prieto', 'Nutrición', 'MP 40.318', '19'],
]
const profesionales: TableDef = {
  key: 'profesionales',
  label: 'Profesionales',
  total: PROFESIONALES.length,
  columns: [
    { key: 'nombre', label: 'Profesional' },
    { key: 'especialidad', label: 'Especialidad' },
    { key: 'matricula', label: 'Matrícula' },
    { key: 'turnos', label: 'Turnos del mes' },
  ],
  row: (i) => {
    const [nombre, esp, mat, t] = PROFESIONALES[i]
    return { nombre: text(nombre, { bold: true }), especialidad: text(esp), matricula: text(mat), turnos: text(t) }
  },
}

// ───────────── Control de stock ─────────────

const PRODUCTOS = ['Tornillo autorroscante', 'Pintura látex 20 L', 'Cinta aisladora', 'Taladro percutor', 'Guantes de seguridad', 'Cable unipolar 2,5 mm', 'Lija al agua grano 120', 'Silicona neutra', 'Llave francesa', 'Cemento 50 kg']
const productos: TableDef = {
  key: 'productos',
  label: 'Productos',
  total: 86,
  columns: [
    { key: 'producto', label: 'Producto' },
    { key: 'codigo', label: 'Código' },
    { key: 'stock', label: 'Stock' },
    { key: 'estado', label: 'Estado' },
  ],
  row: (i) => {
    const r = rng(9000 + i)
    const stock = Math.floor(r() * 120)
    const tone = stock === 0 ? 'neutral' : stock < 15 ? 'warn' : 'ok'
    const label = stock === 0 ? 'Sin stock' : stock < 15 ? 'Stock bajo' : 'Disponible'
    return {
      producto: text(`${PRODUCTOS[i % PRODUCTOS.length]} ${Math.floor(i / PRODUCTOS.length) + 1}`, { bold: true }),
      codigo: text(`PRD-${String(1000 + i)}`),
      stock: text(String(stock)),
      estado: text(label, { tone }),
    }
  },
}
const movimientos: TableDef = {
  key: 'movimientos',
  label: 'Movimientos',
  total: 240,
  columns: [
    { key: 'fecha', label: 'Fecha' },
    { key: 'producto', label: 'Producto' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'cantidad', label: 'Cantidad' },
  ],
  row: (i) => {
    const r = rng(12000 + i)
    const d = new Date()
    d.setDate(d.getDate() - Math.floor(i / 6))
    const ingreso = r() > 0.55
    return {
      fecha: text(`${pad(d.getDate())}/${pad(d.getMonth() + 1)}`),
      producto: text(pick(r, PRODUCTOS), { bold: true }),
      tipo: text(ingreso ? 'Ingreso' : 'Egreso', { tone: ingreso ? 'ok' : 'neutral' }),
      cantidad: text(String(1 + Math.floor(r() * 40))),
    }
  },
}
const proveedores: TableDef = {
  key: 'proveedores',
  label: 'Proveedores',
  total: 9,
  columns: [
    { key: 'nombre', label: 'Proveedor' },
    { key: 'contacto', label: 'Contacto' },
    { key: 'zona', label: 'Zona' },
  ],
  row: (i) => {
    const r = rng(15000 + i)
    return {
      nombre: text(`${pick(r, LAST)} Materiales`, { bold: true }),
      contacto: text(fullName(r)),
      zona: text(pick(r, ['CABA', 'Zona Norte', 'Zona Sur', 'La Plata', 'Córdoba'])),
    }
  },
}

// ───────────── Presupuestos de obra ─────────────

const presupuestos: TableDef = {
  key: 'presupuestos',
  label: 'Presupuestos',
  total: 34,
  columns: [
    { key: 'numero', label: 'Número' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'monto', label: 'Monto' },
    { key: 'estado', label: 'Estado' },
  ],
  row: (i) => {
    const r = rng(18000 + i)
    const roll = r()
    const tone = roll < 0.45 ? 'ok' : roll < 0.8 ? 'warn' : 'neutral'
    const label = tone === 'ok' ? 'Aprobado' : tone === 'warn' ? 'Enviado' : 'Rechazado'
    return {
      numero: text(`PO-${String(2026000 + i + 1)}`, { bold: true }),
      cliente: text(fullName(r)),
      monto: text(`USD ${(800 + Math.floor(r() * 9200)).toLocaleString('es-AR')}`),
      estado: text(label, { tone }),
    }
  },
}
const clientes: TableDef = {
  key: 'clientes',
  label: 'Clientes',
  total: 21,
  columns: [
    { key: 'nombre', label: 'Cliente' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'zona', label: 'Zona' },
  ],
  row: (i) => {
    const r = rng(21000 + i)
    return {
      nombre: text(fullName(r), { bold: true }),
      telefono: text(`11 ${4000 + Math.floor(r() * 5999)}-${1000 + Math.floor(r() * 8999)}`),
      zona: text(pick(r, ['CABA', 'Zona Norte', 'Zona Sur', 'Zona Oeste'])),
    }
  },
}

// ───────────── Calculadora de envíos ─────────────

const tarifas: TableDef = {
  key: 'tarifas',
  label: 'Tarifas',
  total: 18,
  columns: [
    { key: 'zona', label: 'Zona' },
    { key: 'peso', label: 'Peso hasta' },
    { key: 'precio', label: 'Precio' },
    { key: 'plazo', label: 'Plazo' },
  ],
  row: (i) => {
    const zonas = ['CABA', 'GBA Norte', 'GBA Sur', 'GBA Oeste', 'Interior', 'Patagonia']
    const pesos = [1, 5, 10]
    return {
      zona: text(zonas[Math.floor(i / 3)], { bold: true }),
      peso: text(`${pesos[i % 3]} kg`),
      precio: text(`$ ${(2500 + Math.floor(i / 3) * 900 + (i % 3) * 1400).toLocaleString('es-AR')}`),
      plazo: text(`${1 + Math.floor(i / 3)} a ${2 + Math.floor(i / 3)} días`),
    }
  },
}

const BY_APP: Record<string, TableDef[]> = {
  'turnos-consultorio': [turnos, pacientes, profesionales],
  'control-stock': [productos, movimientos, proveedores],
  'presupuestos-obra': [presupuestos, clientes],
  'calculadora-envios': [tarifas],
}

const GENERIC: TableDef = {
  key: 'registros',
  label: 'Registros',
  total: 0,
  columns: [
    { key: 'id', label: 'Id' },
    { key: 'detalle', label: 'Detalle' },
  ],
  row: () => ({}),
}

export function tablesFor(slug: string): TableDef[] {
  return BY_APP[slug] ?? [GENERIC]
}

export function tableMetas(slug: string): DataTableMeta[] {
  return tablesFor(slug).map((t) => ({ key: t.key, label: t.label, count: t.total }))
}

export function tablePage(slug: string, key: string, page: number, pageSize: number): DataTablePage | null {
  const def = tablesFor(slug).find((t) => t.key === key)
  if (!def) return null
  const from = (page - 1) * pageSize
  const rows: Record<string, DataCell>[] = []
  for (let i = from; i < Math.min(def.total, from + pageSize); i++) rows.push(def.row(i))
  return { key: def.key, label: def.label, columns: def.columns, rows, page, pageSize, total: def.total }
}
