<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import type { CurrencyCode } from '../../types'
import {
  SUPPORTED_CURRENCIES,
  currencyDefinition,
  fetchExchangeRate,
  formatConvertedAmount,
  parseAmount,
  type ExchangeRateSnapshot,
} from '../../exchange/exchangeRate'

const store = useSettingsStore()
const baseAmount = ref('100')
const quoteAmount = ref('')
const activeSide = ref<'base' | 'quote'>('base')
const snapshot = ref<ExchangeRateSnapshot | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
let requestId = 0

const baseCurrency = computed(() => store.data.currencyConverter.baseCurrency)
const quoteCurrency = computed(() => store.data.currencyConverter.quoteCurrency)
const baseDefinition = computed(() => currencyDefinition(baseCurrency.value))
const quoteDefinition = computed(() => currencyDefinition(quoteCurrency.value))

const statusText = computed(() => {
  if (isLoading.value && !snapshot.value) return '更新中'
  if (errorMessage.value) return '暂时离线'
  if (!snapshot.value) return '待更新'
  return snapshot.value.date.slice(5).replace('-', '.')
})

function syncFromBase() {
  const amount = parseAmount(baseAmount.value)
  quoteAmount.value = amount === null || !snapshot.value
    ? ''
    : formatConvertedAmount(amount * snapshot.value.rate)
}

function syncFromQuote() {
  const amount = parseAmount(quoteAmount.value)
  baseAmount.value = amount === null || !snapshot.value
    ? ''
    : formatConvertedAmount(amount / snapshot.value.rate)
}

function onBaseInput(event: Event) {
  activeSide.value = 'base'
  baseAmount.value = (event.target as HTMLInputElement).value
  syncFromBase()
}

function onQuoteInput(event: Event) {
  activeSide.value = 'quote'
  quoteAmount.value = (event.target as HTMLInputElement).value
  syncFromQuote()
}

async function loadRate(force = false) {
  const id = ++requestId
  isLoading.value = true
  errorMessage.value = ''
  try {
    const result = await fetchExchangeRate(baseCurrency.value, quoteCurrency.value, fetch, force)
    if (id !== requestId) return
    snapshot.value = result
    if (activeSide.value === 'base') syncFromBase()
    else syncFromQuote()
  } catch (error) {
    if (id !== requestId) return
    errorMessage.value = error instanceof Error ? error.message : '汇率加载失败'
  } finally {
    if (id === requestId) isLoading.value = false
  }
}

function setBaseCurrency(event: Event) {
  const next = (event.target as HTMLSelectElement).value as CurrencyCode
  if (next === quoteCurrency.value) {
    store.setCurrencyPair(next, baseCurrency.value)
  } else {
    store.setCurrencyPair(next, quoteCurrency.value)
  }
}

function setQuoteCurrency(event: Event) {
  const next = (event.target as HTMLSelectElement).value as CurrencyCode
  if (next === baseCurrency.value) {
    store.setCurrencyPair(quoteCurrency.value, next)
  } else {
    store.setCurrencyPair(baseCurrency.value, next)
  }
}

watch([baseCurrency, quoteCurrency], () => {
  snapshot.value = null
  void loadRate()
})

onMounted(() => void loadRate())
</script>

<template>
  <section
    class="currency-widget"
    :class="{ 'reduced-effects': store.data.performanceMode }"
    aria-label="汇率换算器"
  >
    <header class="currency-header">
      <div class="title-group">
        <span class="ledger-mark" aria-hidden="true">¥</span>
        <div>
          <h3>汇率换算</h3>
          <p>Currency desk</p>
        </div>
      </div>
      <button
        class="refresh-button"
        type="button"
        :class="{ loading: isLoading }"
        :disabled="isLoading"
        :title="errorMessage || '刷新汇率'"
        @click="loadRate(true)"
      >
        <span class="status-dot" :class="{ error: errorMessage }"></span>
        <span>{{ statusText }}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
        </svg>
      </button>
    </header>

    <div class="conversion-ledger">
      <div class="currency-row base-row">
        <div class="currency-picker">
          <span class="currency-symbol" aria-hidden="true">{{ baseDefinition.symbol }}</span>
          <label class="currency-select-wrap">
            <span class="sr-only">原始货币</span>
            <select :value="baseCurrency" @change="setBaseCurrency">
              <option v-for="currency in SUPPORTED_CURRENCIES" :key="currency.code" :value="currency.code">
                {{ currency.code }} · {{ currency.name }}
              </option>
            </select>
          </label>
        </div>
        <input
          :value="baseAmount"
          class="amount-input"
          inputmode="decimal"
          autocomplete="off"
          aria-label="原始金额"
          @input="onBaseInput"
        />
      </div>

      <div class="currency-row quote-row">
        <div class="currency-picker">
          <span class="currency-symbol" aria-hidden="true">{{ quoteDefinition.symbol }}</span>
          <label class="currency-select-wrap">
            <span class="sr-only">目标货币</span>
            <select :value="quoteCurrency" @change="setQuoteCurrency">
              <option v-for="currency in SUPPORTED_CURRENCIES" :key="currency.code" :value="currency.code">
                {{ currency.code }} · {{ currency.name }}
              </option>
            </select>
          </label>
        </div>
        <input
          :value="quoteAmount"
          class="amount-input"
          inputmode="decimal"
          autocomplete="off"
          aria-label="换算金额"
          placeholder="—"
          @input="onQuoteInput"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.currency-widget {
  --cny-marker: #d96a5c;
  --quote-marker: #5f9b7b;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px 14px 12px;
  overflow: hidden;
  border-radius: 20px;
  isolation: isolate;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-secondary) 97%, transparent);
  background-clip: padding-box;
  backdrop-filter: blur(24px) saturate(1.08);
  -webkit-backdrop-filter: blur(24px) saturate(1.08);
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255, 255, 255, 0.055);
  user-select: none;
}

.currency-widget::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--cny-marker) 72%, transparent);
}

.currency-widget.reduced-effects {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}

.currency-header,
.title-group,
.currency-picker {
  display: flex;
  align-items: center;
}

.currency-header {
  justify-content: space-between;
  gap: 7px;
  margin-bottom: 10px;
}

.title-group { gap: 7px; min-width: 0; }

.ledger-mark {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--cny-marker) 34%, var(--border));
  border-radius: 9px;
  color: var(--cny-marker);
  background: color-mix(in srgb, var(--cny-marker) 10%, transparent);
  font: 650 15px/1 ui-monospace, 'SFMono-Regular', Consolas, monospace;
}

h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.title-group p {
  margin-top: 2px;
  color: var(--text-secondary);
  font: 500 8px/1.2 ui-monospace, 'SFMono-Regular', Consolas, monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.7;
}

.refresh-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-secondary);
  background: transparent;
  font: 500 9px/1 ui-monospace, 'SFMono-Regular', Consolas, monospace;
}

.refresh-button:hover { color: var(--text-primary); }
.refresh-button.loading svg { animation: rate-spin 0.8s linear infinite; }

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--quote-marker);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--quote-marker) 12%, transparent);
}

.status-dot.error { background: var(--cny-marker); box-shadow: none; }

.conversion-ledger {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-rows: 1fr 1fr;
  min-height: 0;
  border-block: 1px solid var(--border);
}

.currency-row {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  padding: 5px 0;
}

.currency-row:first-child { border-bottom: 1px solid var(--border); }

.currency-symbol {
  width: 25px;
  flex: 0 0 25px;
  color: var(--cny-marker);
  font: 600 14px/1 ui-monospace, 'SFMono-Regular', Consolas, monospace;
  text-align: center;
}

.quote-row .currency-symbol { color: var(--quote-marker); }

.currency-picker { gap: 6px; min-width: 0; }

.currency-select-wrap { flex: 1; min-width: 0; }

select {
  width: 100%;
  padding: 5px 24px 5px 8px;
  border: 0;
  border-radius: 7px;
  color: var(--text-secondary);
  background: var(--bg-glass);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.amount-input {
  min-width: 0;
  width: 100%;
  padding: 5px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: color-mix(in srgb, var(--bg-glass) 88%, transparent);
  color: var(--text-primary);
  font: 500 17px/1.2 ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
  text-align: right;
  user-select: text;
}

.amount-input:focus { border-color: var(--border-focus); }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes rate-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .refresh-button.loading svg { animation: none; }
}
</style>
