'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type DataSaverContextValue = {
  lowDataMode: boolean
}

type DataSaverProviderProps = {
  initialLowDataMode: boolean
  children: React.ReactNode
}

const DataSaverContext = createContext<DataSaverContextValue>({ lowDataMode: false })
const STORAGE_KEY = 'smartnekam:low-data-mode'
const CHANGE_EVENT = 'smartnekam:low-data-mode-change'

type SaveDataConnection = EventTarget & { saveData?: boolean }

function browserRequestsDataSaving() {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: SaveDataConnection }).connection
  return Boolean(connection?.saveData)
}

export function DataSaverProvider({ initialLowDataMode, children }: DataSaverProviderProps) {
  const [userEnabled, setUserEnabled] = useState(initialLowDataMode)
  const [networkEnabled, setNetworkEnabled] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') setUserEnabled(true)
      else if (stored === 'false') setUserEnabled(false)
    } catch {
      // Private-browsing restrictions should not prevent the app from running.
    }

    const connection = (navigator as Navigator & { connection?: SaveDataConnection }).connection
    const syncNetworkPreference = () => setNetworkEnabled(Boolean(connection?.saveData))
    syncNetworkPreference()
    connection?.addEventListener?.('change', syncNetworkPreference)

    const handlePreferenceChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail
      if (typeof detail?.enabled !== 'boolean') return
      setUserEnabled(detail.enabled)
      try {
        window.localStorage.setItem(STORAGE_KEY, String(detail.enabled))
      } catch {
        // The database preference remains the source of truth across signed-in sessions.
      }
    }
    window.addEventListener(CHANGE_EVENT, handlePreferenceChange)

    return () => {
      connection?.removeEventListener?.('change', syncNetworkPreference)
      window.removeEventListener(CHANGE_EVENT, handlePreferenceChange)
    }
  }, [])

  const value = useMemo(() => ({ lowDataMode: userEnabled || networkEnabled }), [userEnabled, networkEnabled])
  return <DataSaverContext.Provider value={value}>{children}</DataSaverContext.Provider>
}

export function useDataSaver() {
  return useContext(DataSaverContext)
}
