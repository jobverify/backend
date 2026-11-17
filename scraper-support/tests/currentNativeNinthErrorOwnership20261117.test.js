import assert from 'node:assert/strict'
import test, {mock} from 'node:test'
import {run as noBroker} from '../../scraper/nobrokers/script.js'
import {run as netrack} from '../../scraper/netrack/script.js'
import {run as macreq} from '../../scraper/macreq/script.js'

for (const [source, run] of [['nobrokers', noBroker], ['netrack', netrack], ['macreq', macreq]]) {
  test(source + ' preserves exact caller cancellation during failure evidence attachment', async () => {
    for (const reason of [Object.freeze({source, phase: 'failure-evidence'}), null]) {
      const caller = new AbortController()
      const define = Object.defineProperty
      let requests = 0, attachments = 0
      const attachment = mock.method(Object, 'defineProperty', (target, key, descriptor) => {
        const result = define(target, key, descriptor)
        if (target instanceof Error && key === 'recruitmentObservations') {
          attachments++
          caller.abort(reason)
        }
        return result
      })
      try {
        await assert.rejects(run({signal: caller.signal, fetchImpl: async url => {
          requests++
          const response = new Response('Observed native access denial', {
            status: 403, headers: {'content-type': 'text/html'},
          })
          define(response, 'url', {value: url})
          return response
        }}), error => error === reason)
        assert.equal(requests, 1)
        assert.equal(attachments, 1)
      } finally {
        attachment.mock.restore()
      }
    }
  })
}
