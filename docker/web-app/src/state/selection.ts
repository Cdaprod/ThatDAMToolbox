import { useSyncExternalStore } from 'react'

export interface SelState {
  ids: Set<string>
  toggle: (id: string) => void
  clear: () => void
  setMany: (ids: string[]) => void
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const state: SelState = {
  ids: new Set<string>(),
  toggle: (id) => {
    state.ids.has(id) ? state.ids.delete(id) : state.ids.add(id)
    emit()
  },
  clear: () => {
    state.ids = new Set()
    emit()
  },
  setMany: (arr) => {
    state.ids = new Set(arr)
    emit()
  },
}

export function useSelection() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export { state as selectionStore }
