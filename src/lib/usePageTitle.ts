import { useEffect } from 'react'

export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Cellula` : 'Cellula'
  }, [title])
}
