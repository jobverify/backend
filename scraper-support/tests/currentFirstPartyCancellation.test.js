import assert from 'node:assert/strict'
import test from 'node:test'
for (const source of ['algonomy', 'springworks', 'lumo', 'netcorecloud']) {
  test(source + ' preserves caller cancellation before any public request', async () => {
    const { run } = await import('../../scraper/' + source + '/script.js')
    const reason = new Error('Cancelled before request')
    const fetcher = async () => assert.fail('Cancelled source must not request network')
    await assert.rejects(run({signal: AbortSignal.abort(reason), fetchPage: fetcher, fetchText: fetcher, fetchJson: fetcher}), error => error === reason)
  })
}
