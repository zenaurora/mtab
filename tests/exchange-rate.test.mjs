import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

async function loadExchangeModule() {
  const server = await createServer({
    appType: 'custom',
    server: { hmr: false, middlewareMode: true, ws: false },
  })
  try {
    return await server.ssrLoadModule('/src/exchange/exchangeRate.ts')
  } finally {
    await server.close()
  }
}

test('exchange rate client requests one currency pair and validates the response', async () => {
  const exchange = await loadExchangeModule()
  let requestedUrl = ''
  const snapshot = await exchange.fetchExchangeRate('CNY', 'USD', async (url) => {
    requestedUrl = url
    return new Response(JSON.stringify({ base: 'CNY', quote: 'USD', rate: 0.1372, date: '2026-08-21' }))
  }, true)

  assert.equal(requestedUrl, 'https://api.frankfurter.dev/v2/rate/CNY/USD')
  assert.deepEqual(snapshot, {
    base: 'CNY',
    quote: 'USD',
    rate: 0.1372,
    date: '2026-08-21',
  })
})

test('amount helpers keep conversion input predictable', async () => {
  const exchange = await loadExchangeModule()
  assert.equal(exchange.parseAmount('1,234.50'), 1234.5)
  assert.equal(exchange.parseAmount('-2'), null)
  assert.equal(exchange.parseAmount(''), null)
  assert.equal(exchange.formatConvertedAmount(13.72891), '13.729')
})
