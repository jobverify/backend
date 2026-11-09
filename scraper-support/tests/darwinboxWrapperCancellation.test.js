import assert from 'node:assert/strict'
import test from 'node:test'

for (const source of ['affle', 'axio', 'bigbasket', 'cardekho', 'brigadegroup']) {
  test(`${source} rejects a caller abort before its corporate binding request`, async () => {
    const { run } = await import(`../../scraper/${source}/script.js`)
    const reason = new Error(`stop ${source}`)
    let requests = 0
    await assert.rejects(run({ signal: AbortSignal.abort(reason), fetchText: async () => { requests++; return '' } }), error => error === reason)
    assert.equal(requests, 0)
  })

  test(`${source} forwards cancellation through its corporate binding request`, async () => {
    const { run } = await import(`../../scraper/${source}/script.js`)
    const controller = new AbortController()
    const reason = new Error(`stop active ${source}`)
    let requestSignal
    await assert.rejects(run({ signal: controller.signal, fetchText: async (_url, options = {}) => {
      requestSignal = options.signal
      controller.abort(reason)
      return ''
    } }), error => error === reason)
    assert.equal(requestSignal, controller.signal)
  })
}
