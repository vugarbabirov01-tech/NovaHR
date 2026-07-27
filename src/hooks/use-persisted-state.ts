"use client"

import { useEffect, useState } from "react"

export function usePersistedState<T extends string>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    const stored = window.localStorage.getItem(key)
    if (stored) setValue(stored as T)
  }, [key])

  function update(next: T) {
    setValue(next)
    window.localStorage.setItem(key, next)
  }

  return [value, update] as const
}
