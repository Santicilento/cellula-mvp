import type { ReactNode } from 'react'

export function StatCard({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="cl-stat">
      <div className="cl-stat__label">{label}</div>
      <div className="cl-stat__value">{value}</div>
      <div className="cl-stat__note">{note}</div>
    </div>
  )
}
