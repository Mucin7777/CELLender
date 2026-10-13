import { useEffect, useState } from 'react'

export type Route = { view: 'home' } | { view: 'lines'; id?: string } | { view: 'seedings'; id?: string } | { view: 'settings' }

export function parseHash(hash: string): Route {
  const [view, id] = hash.replace(/^#\/?/, '').split('/')
  switch (view) {
    case 'lines':
      return { view: 'lines', id: id || undefined }
    case 'seedings':
    case 'assays':
      return { view: 'seedings', id: (view === 'seedings' && id) || undefined }
    case 'settings':
      return { view: 'settings' }
    default:
      return { view: 'home' }
  }
}

export const routeToHash = (r: Route): string => {
  if (r.view === 'home') return '#/'
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
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
