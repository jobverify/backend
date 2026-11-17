import assert from 'node:assert/strict'
import test from 'node:test'
import {run, HOMEPAGE_URL} from './script.js'

for (const header of ['cf-mitigated', 'x-amzn-waf-action']) {
  test('exact SumTotal308 cannot bypass the original ' + header + ' challenge', async () => {
    for (const value of ['challenge', ' ChAlLeNgE ']) {
      let requests = 0, reads = 0
      await assert.rejects(run({fetchImpl: async url => {
        requests++
        assert.equal(url, HOMEPAGE_URL)
        return {url, status: 308, headers: new Headers({location: 'https://www.cornerstoneondemand.com/',
          'content-type': 'text/html', [header]: value}), body: {cancel: async () => {}, getReader() {
          reads++
          throw Error('Challenge entity must remain unread')
        }}}
      }}), error => error.httpStatus === 308 && error.accessChallenge === true
        && error.failureKind === 'blocked_or_access_denied'
        && error.recruitmentObservations.originalResponses[0].status === 308)
      assert.equal(requests, 1)
      assert.equal(reads, 0)
    }
  })
}
