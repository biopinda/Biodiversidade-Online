/**
 * Hook para gerenciamento de armazenamento seguro com criptografia
 *
 * Implementa rate limiting por sessão e criptografia de dados sensíveis
 * usando sessionStorage em vez de localStorage para melhor segurança.
 */

import { useCallback, useEffect, useState } from 'react'
import { decrypt, encrypt } from './crypto'

interface RateLimitEntry {
  count: number
  resetTime: number
}

const RATE_LIMIT_WINDOW = 60000
const MAX_REQUESTS_PER_WINDOW = 100

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()

  check(key: string): boolean {
    const now = Date.now()
    const entry = this.limits.get(key)

    if (!entry || now > entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      })
      return true
    }

    if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
      return false
    }

    entry.count++
    return true
  }

  reset(key: string): void {
    this.limits.delete(key)
  }
}

const rateLimiter = new RateLimiter()

interface UseSecureStorageOptions {
  encryptionPassword?: string
  onPasswordRequired?: () => void
  onRateLimitExceeded?: () => void
}

export function useSecureStorage<T>(
  key: string,
  defaultValue: T,
  options: UseSecureStorageOptions = {}
) {
  const [value, setValue] = useState<T>(defaultValue)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { encryptionPassword, onPasswordRequired, onRateLimitExceeded } =
    options

  const loadValue = useCallback(async () => {
    if (!encryptionPassword) {
      setIsLoading(false)
      return
    }

    if (!rateLimiter.check(`read_${key}`)) {
      setError('Rate limit excedido. Tente novamente em alguns instantes.')
      onRateLimitExceeded?.()
      setIsLoading(false)
      return
    }

    try {
      const stored = sessionStorage.getItem(key)
      if (stored) {
        const decrypted = await decrypt(stored, encryptionPassword)
        setValue(JSON.parse(decrypted) as T)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      onPasswordRequired?.()
    } finally {
      setIsLoading(false)
    }
  }, [key, encryptionPassword, onPasswordRequired, onRateLimitExceeded])

  const saveValue = useCallback(
    async (newValue: T) => {
      if (!encryptionPassword) {
        setValue(newValue)
        return
      }

      if (!rateLimiter.check(`write_${key}`)) {
        setError('Rate limit excedido. Tente novamente em alguns instantes.')
        onRateLimitExceeded?.()
        return
      }

      try {
        const serialized = JSON.stringify(newValue)
        const encrypted = await encrypt(serialized, encryptionPassword)
        sessionStorage.setItem(key, encrypted)
        setValue(newValue)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar dados')
      }
    },
    [key, encryptionPassword, onRateLimitExceeded]
  )

  const clearValue = useCallback(() => {
    sessionStorage.removeItem(key)
    setValue(defaultValue)
    rateLimiter.reset(`read_${key}`)
    rateLimiter.reset(`write_${key}`)
    setError(null)
  }, [key, defaultValue])

  useEffect(() => {
    loadValue()
  }, [loadValue])

  return {
    value,
    setValue: saveValue,
    clearValue,
    isLoading,
    error
  }
}
