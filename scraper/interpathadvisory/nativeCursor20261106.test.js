import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captured = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261106/inventory.json.gz', import.meta.url))))
const listingUrl = 'https://apply.workable.com/api/v3/accounts/interpath-advisory/jobs'
const expectedIds = ['06DB6B028D', '0D8A60AECB', '3762060F64', '3D19B5AC22', '4D1ECD3796', '5C216A1B44',
  '8EEF83FB04', '928DA16D66', 'B89D9B56F7', 'CFEF194C8F', 'D5B1FF4C82', 'DD4CA43546', 'E9EE99A7BE', 'EC62C1AE39']

function replay(change = page => page) {
  const listings = []
  return {
    listings,
    now: () => '2026-11-06T12:00:00.000Z',
    fetchPage: async url => {
      assert.equal(url, captured.careersUrl)
      return { status: 200, url, html: captured.careersHtml }
    },
    fetchJson: async (url, init = {}) => {
      if (url.endsWith('/api/v1/accounts/interpath-advisory')) return structuredClone(captured.account)
      if (url === listingUrl) {
        const body = JSON.parse(init.body)
        assert.deepEqual({ ...body, token: undefined }, { query: '', location: [], department: [], worktype: [], remote: [], token: undefined })
        const index = body.token === undefined ? 0 : captured.pages.findIndex(page => page.nextPage === body.token) + 1
        assert.ok(index >= 0 && captured.pages[index], 'Only a native-declared cursor may be requested')
        listings.push(index + 1)
        return change(structuredClone(captured.pages[index]), index)
      }
      const prefix = 'https://apply.workable.com/api/v2/accounts/interpath-advisory/jobs/'
      assert.ok(url.startsWith(prefix))
      const detail = captured.details[url.slice(prefix.length)]
      assert.ok(detail, 'Only explicitly India-scoped native details may be fetched')
      return structuredClone(detail)
    },
  }
}

test('Interpath follows the full-count cursor to its native empty terminal page before qualifying 14 India details', async () => {
  const options = replay(), jobs = await run(options)
  assert.deepEqual(options.listings, [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.deepEqual(jobs.map(job => job.jobId).sort(), expectedIds)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete
    && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /closing-snapshot-reconciled/)
})

test('a cursor after the full count cannot bypass an extra role on the terminal page', async () => {
  await assert.rejects(run(replay((page, index) => {
    if (index === 8) page.results = [{ ...structuredClone(captured.pages[0].results[0]), id: 999999999, shortcode: 'EXTRA99999' }]
    return page
  })), /record count exceeds the authoritative total/)
})

test('an empty terminal page that advertises another cursor remains a contract failure', async () => {
  await assert.rejects(run(replay((page, index) => {
    if (index === 8) page.nextPage = 'unexpected-continuation'
    return page
  })), /cursor contradicts the authoritative record count/)
})
