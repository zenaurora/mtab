import type { CurrencyCode } from '../types'

export interface CurrencyDefinition {
  code: CurrencyCode
  symbol: string
  name: string
}

export interface ExchangeRateSnapshot {
  base: CurrencyCode
  quote: CurrencyCode
  rate: number
  date: string
}

export const SUPPORTED_CURRENCIES: CurrencyDefinition[] = [
  { code: 'CNY', symbol: '¥', name: '人民币' },
  { code: 'USD', symbol: '$', name: '美元' },
  { code: 'EUR', symbol: '€', name: '欧元' },
  { code: 'GBP', symbol: '£', name: '英镑' },
  { code: 'JPY', symbol: '¥', name: '日元' },
  { code: 'HKD', symbol: 'HK$', name: '港币' },
  { code: 'KRW', symbol: '₩', name: '韩元' },
  { code: 'SGD', symbol: 'S$', name: '新币' },
  { code: 'AUD', symbol: 'A$', name: '澳元' },
  { code: 'CAD', symbol: 'C$', name: '加元' },
  { code: 'CHF', symbol: 'Fr', name: '瑞士法郎' },
]

export const SUPPORTED_CURRENCY_CODES = new Set<CurrencyCode>(
  SUPPORTED_CURRENCIES.map((currency) => currency.code),
)

const CACHE_TTL_MS = 30 * 60 * 1000
const rateCache = new Map<string, { snapshot: ExchangeRateSnapshot; expiresAt: number }>()
const pendingRequests = new Map<string, Promise<ExchangeRateSnapshot>>()

export function isSupportedCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && SUPPORTED_CURRENCY_CODES.has(value as CurrencyCode)
}

export function currencyDefinition(code: CurrencyCode): CurrencyDefinition {
  return SUPPORTED_CURRENCIES.find((currency) => currency.code === code) ?? SUPPORTED_CURRENCIES[0]
}

export async function fetchExchangeRate(
  base: CurrencyCode,
  quote: CurrencyCode,
  fetcher: typeof fetch = fetch,
  force = false,
): Promise<ExchangeRateSnapshot> {
  if (base === quote) {
    return { base, quote, rate: 1, date: new Date().toISOString().slice(0, 10) }
  }

  const key = `${base}/${quote}`
  const cached = rateCache.get(key)
  if (!force && cached && cached.expiresAt > Date.now()) return cached.snapshot

  const pending = pendingRequests.get(key)
  if (!force && pending) return pending

  const request = fetcher(`https://api.frankfurter.dev/v2/rate/${base}/${quote}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Exchange rate request failed (${response.status})`)
      const payload = await response.json() as Record<string, unknown>
      if (
        !isSupportedCurrencyCode(payload.base) ||
        !isSupportedCurrencyCode(payload.quote) ||
        typeof payload.rate !== 'number' ||
        !Number.isFinite(payload.rate) ||
        payload.rate <= 0 ||
        typeof payload.date !== 'string'
      ) {
        throw new Error('Exchange rate response is invalid')
      }
      const snapshot: ExchangeRateSnapshot = {
        base: payload.base,
        quote: payload.quote,
        rate: payload.rate,
        date: payload.date,
      }
      rateCache.set(key, { snapshot, expiresAt: Date.now() + CACHE_TTL_MS })
      return snapshot
    })
    .finally(() => pendingRequests.delete(key))

  pendingRequests.set(key, request)
  return request
}

export function formatConvertedAmount(value: number): string {
  if (!Number.isFinite(value)) return ''
  const digits = Math.abs(value) >= 100 ? 2 : Math.abs(value) >= 1 ? 3 : 4
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value)
}

export function parseAmount(value: string): number | null {
  const normalized = value.trim().replaceAll(',', '')
  if (normalized === '') return null
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}
