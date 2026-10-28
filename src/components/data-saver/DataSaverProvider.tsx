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

export function DataSaverProvider({ initialLowDataMode, children }: DataSaverProviderProps) {
  const [userEnabled, setUserEnabled] = useState(initialLowDataMode)
  const [networkEnabled, setNetworkEnabled] = useState(false)

  useEffect(() => {
    // The signed-in user's database preference is authoritative on page load.
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
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || (event.newValue !== 'true' && event.newValue !== 'false')) return
      setUserEnabled(event.newValue === 'true')
    }
    window.addEventListener(CHANGE_EVENT, handlePreferenceChange)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      connection?.removeEventListener?.('change', syncNetworkPreference)
      window.removeEventListener(CHANGE_EVENT, handlePreferenceChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const value = useMemo(() => ({ lowDataMode: userEnabled || networkEnabled }), [userEnabled, networkEnabled])
  return <DataSaverContext.Provider value={value}>{children}</DataSaverContext.Provider>
}

export function useDataSaver() {
  return useContext(DataSaverContext)
}
