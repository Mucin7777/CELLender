import { useEffect, useState } from 'react'

export type Route =
  | { view: 'today' }
  | { view: 'calendar' }
  | { view: 'lines'; id?: string }
  | { view: 'seedings'; id?: string }
  | { view: 'assays' }
  | { view: 'settings' }

export function parseHash(hash: string): Route {
  const [view, id] = hash.replace(/^#\/?/, '').split('/')
  switch (view) {
    case 'calendar':
      return { view: 'calendar' }
    case 'lines':
      return { view: 'lines', id: id || undefined }
    case 'seedings':
      return { view: 'seedings', id: id || undefined }
    case 'assays':
      return { view: 'assays' }
    case 'settings':
      return { view: 'settings' }
    default:
      return { view: 'today' }
  }
}

export const routeToHash = (r: Route): string => {
  if (r.view === 'today') return '#/'
  if ((r.view === 'lines' || r.view === 'seedings') && r.id) return `#/${r.view}/${r.id}`
  return `#/${r.view}`
}

export const navigate = (r: Route) => {
  window.location.hash = routeToHash(r)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      document.getElementById('main-scroll')?.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
