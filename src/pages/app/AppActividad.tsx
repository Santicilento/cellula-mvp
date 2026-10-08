import { ActivityFeed } from '../../components/ActivityFeed'
import { useAppContext } from './useAppContext'

export default function AppActividad() {
  const { app } = useAppContext()
  return <ActivityFeed fixedApp={app.slug} />
}
