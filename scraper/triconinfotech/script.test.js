import assert from 'node:assert/strict'
import test from 'node:test'

const loadTriconModule = () => import('./script.js')

test('HTTP transport failures surface instead of being retried through a browser fallback', async () => {
  const tricon = await loadTriconModule()

  await assert.rejects(
    tricon.run({
      fetchText: async () => { throw new Error('fetch failed: test transport outage') },
      fetchJson: async () => [],
    }),
    /fetch failed: test transport outage/,
  )
})
