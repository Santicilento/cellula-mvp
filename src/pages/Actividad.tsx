import { ActivityFeed, ActivityLegend } from '../components/ActivityFeed'
import { PageHeader } from '../components/layout/PageHeader'
import { usePageTitle } from '../lib/usePageTitle'

export default function Actividad() {
  usePageTitle('Actividad')
  return (
    <div className="page">
      <PageHeader
        title="Actividad"
        subtitle="Quién entró, qué se publicó y qué permisos cambiaron en tus apps."
        actions={<ActivityLegend />}
      />
      <ActivityFeed />
    </div>
  )
}
