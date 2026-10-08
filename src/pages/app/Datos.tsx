import clsx from 'clsx'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDataOverview, useTablePage } from '../../api/queries'
import type { DataCell } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { formatNumber } from '../../lib/format'
import { useAppContext } from './useAppContext'

const PAGE_SIZE = 6

function Cell({ cell }: { cell: DataCell | undefined }) {
  if (!cell) return null
  if (cell.tone) return <Badge tone={cell.tone}>{cell.text}</Badge>
  return cell.bold ? <strong>{cell.text}</strong> : <>{cell.text}</>
}

/** Datos que guarda la app: lista de tablas y tabla paginada. */
export default function Datos() {
  const { app } = useAppContext()
  const overview = useDataOverview(app.slug)
  const [params] = useSearchParams()
  const tableKey = params.get('tabla') ?? overview.data?.tables[0]?.key
  // La página pertenece a una tabla: al cambiar de tabla vuelve a la primera.
  const [paging, setPaging] = useState({ key: tableKey, page: 1 })
  const page = paging.key === tableKey ? paging.page : 1
  const setPage = (update: (p: number) => number) => setPaging({ key: tableKey, page: update(page) })
  const table = useTablePage(app.slug, tableKey, page, PAGE_SIZE)

  if (overview.isError) return <ErrorState onRetry={() => overview.refetch()} />
  if (!overview.data) return <Skeleton style={{ height: 420 }} />

  const { tables, usedMB, quotaMB } = overview.data
  const t = table.data
  const from = t ? (t.page - 1) * t.pageSize + 1 : 0
  const to = t ? Math.min(t.total, t.page * t.pageSize) : 0

  return (
    <>
      <p className="lead">
        Acá se guardan los datos que carga tu app, como los turnos. Solo los ven las personas con rol <b>Administrar</b>.
      </p>

      <div className="data-layout">
        <aside className="data-side">
          <nav className="cl-card data-list" aria-label="Tablas">
            {tables.map((x) => (
              <Link
                key={x.key}
                to={`?tabla=${x.key}`}
                replace
                className={clsx('data-list__item', x.key === tableKey && 'data-list__item--on')}
                aria-current={x.key === tableKey ? 'page' : undefined}
              >
                <span>{x.label}</span>
                <span className="data-list__count">{formatNumber(x.count)}</span>
              </Link>
            ))}
          </nav>
          <section className="cl-card storage">
            <div className="storage__row"><b>Espacio usado</b><span className="muted">{formatNumber(usedMB, 1)} MB</span></div>
            <div className="cl-meter" role="progressbar" aria-label="Espacio usado" aria-valuemin={0} aria-valuemax={quotaMB} aria-valuenow={usedMB}>
              <span style={{ width: `${Math.max(2, (usedMB / quotaMB) * 100)}%` }} />
            </div>
            <span className="cl-field__help">Cada app guarda sus datos por separado.</span>
          </section>
        </aside>

        <section className="cl-card data-main">
          <div className="data-main__head"><h2>{t?.label ?? ' '}</h2></div>
          {table.isError ? (
            <ErrorState onRetry={() => table.refetch()} />
          ) : !t ? (
            <Skeleton style={{ height: 360, borderRadius: 0 }} />
          ) : (
            <>
              <div className="table-scroll">
                <table className="cl-table data-table" aria-busy={table.isFetching}>
                  <thead>
                    <tr>{t.columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r, i) => (
                      <tr key={i}>{t.columns.map((c) => <td key={c.key}><Cell cell={r[c.key]} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="data-main__foot">
                <span>Mostrando {from}–{to} de {formatNumber(t.total)}</span>
                <span className="data-main__pager">
                  <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <Button size="sm" disabled={to >= t.total} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}
