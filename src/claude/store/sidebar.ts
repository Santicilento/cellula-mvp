import { useSyncExternalStore } from 'react'
import { useRuntime } from './controller'
import { useClaude } from './store'

const QUERY = '(max-width: 860px)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** ¿La pantalla es angosta? Ahí la barra lateral es un cajón que se abre encima. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}

/**
 * Estado de la barra lateral. En escritorio se guarda la preferencia (abierta o plegada);
 * en celular es un cajón temporal que siempre arranca cerrado.
 */
export function useSidebar() {
  const narrow = useNarrow()
  const desktopOpen = useClaude((s) => s.sidebarOpen)
  const setDesktopOpen = useClaude((s) => s.setSidebarOpen)
  const drawerOpen = useRuntime((s) => s.drawerOpen)
  const setDrawerOpen = useRuntime((s) => s.setDrawerOpen)
  return {
    narrow,
    open: narrow ? drawerOpen : desktopOpen,
    setOpen: narrow ? setDrawerOpen : setDesktopOpen,
    /** Al elegir algo en el cajón del celular, se cierra. */
    closeDrawer: () => {
      if (narrow) setDrawerOpen(false)
    },
  }
}
