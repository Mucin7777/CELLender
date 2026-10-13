import { useMemo } from 'react'
import { useStore, selectData } from '../store/useStore'
import { useShallow } from 'zustand/react/shallow'
import { buildCalendarEvents } from './events'

export function useCalendarEvents() {
  const data = useStore(useShallow(selectData))
  return useMemo(() => buildCalendarEvents(data), [data])
}
