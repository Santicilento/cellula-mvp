import { useOutletContext } from 'react-router-dom'
import type { AppSummary } from '../../api/types'

/** La app del detalle (la carga AppLayout y la comparten Accesos, Actividad, Datos y Configuración). */
export function useAppContext() {
  return useOutletContext<{ app: AppSummary }>()
}
