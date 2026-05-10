import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type HistoryMode = 'replace' | 'push'

type Updater<T> = T | ((previous: T) => T)

type Options<T> = {
  defaultState: T
  parse: (params: URLSearchParams) => Partial<T>
  serialize: (state: T) => URLSearchParams
  historyMode?: HistoryMode
}

const hasWindow = typeof window !== 'undefined'

const createSearchParams = (entries: [string, string][]) => {
  const params = new URLSearchParams()

  entries.forEach(([key, value]) => {
    if (value !== '') {
      params.set(key, value)
    }
  })

  return params
}

const mergeState = <T>(defaultState: T, parsed: Partial<T>): T => {
  if (Array.isArray(defaultState)) {
    return ((parsed as unknown as T) ?? defaultState) as T
  }

  if (
    defaultState !== null &&
    typeof defaultState === 'object' &&
    parsed !== null &&
    typeof parsed === 'object'
  ) {
    return { ...(defaultState as object), ...(parsed as object) } as T
  }

  return (parsed ?? defaultState) as T
}

const applyUpdater = <T>(previous: T, updater: Updater<T>) =>
  typeof updater === 'function'
    ? (updater as (prev: T) => T)(previous)
    : updater

export function useSearchParamsState<T>({
  defaultState,
  parse,
  serialize,
  historyMode = 'replace'
}: Options<T>) {
  const parseRef = useRef(parse)
  const serializeRef = useRef(serialize)
  const defaultStateRef = useRef(defaultState)
  const historyModeRef = useRef(historyMode)

  useEffect(() => {
    parseRef.current = parse
    serializeRef.current = serialize
    defaultStateRef.current = defaultState
    historyModeRef.current = historyMode
  }, [parse, serialize, defaultState, historyMode])

  const initialState = useMemo(() => {
    if (!hasWindow) {
      return defaultState
    }

    const urlParams = new URLSearchParams(window.location.search)
    const parsed = parseRef.current(urlParams)
    return mergeState(defaultStateRef.current, parsed)
  }, [defaultState])

  const [state, setState] = useState<T>(initialState)

  const syncWithUrl = useCallback((nextState: T) => {
    if (!hasWindow) return

    const params = serializeRef.current(nextState)
    const search = params.toString()
    const url = `${window.location.pathname}${search ? `?${search}` : ''}`
    const historyFn =
      historyModeRef.current === 'push'
        ? window.history.pushState
        : window.history.replaceState

    historyFn.call(window.history, {}, '', url)
  }, [])

  const setQueryState = useCallback(
    (updater: Updater<T>) => {
      setState((previous) => {
        const nextState = applyUpdater(previous, updater)
        syncWithUrl(nextState)
        return nextState
      })
    },
    [syncWithUrl]
  )

  useEffect(() => {
    if (!hasWindow) return

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const parsed = parseRef.current(params)
      setState(mergeState(defaultStateRef.current, parsed))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!hasWindow) return
    // Ensure initial URL state matches defaults when component mounts
    const params = serializeRef.current(state)
    const currentSearch = window.location.search.replace(/^\?/, '')
    if (params.toString() === currentSearch) {
      return
    }
    syncWithUrl(state)
  }, [state, syncWithUrl])

  return [state, setQueryState] as const
}

export const serializeRecord = (value: Record<string, string>) =>
  createSearchParams(Object.entries(value).filter(([, v]) => v !== ''))

export const parseRecord = (
  params: URLSearchParams,
  allowedKeys: string[]
): Record<string, string> => {
  const result: Record<string, string> = {}

  allowedKeys.forEach((key) => {
    const value = params.get(key)
    if (value) {
      result[key] = value
    }
  })

  return result
}
