import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import {
  CAREERS_PAGE_URL,
  OFFICIAL_CAREERS_HANDOFF_URL,
  createTalentSprintScraper,
} from './script.js'

const verifiedCareersPage = readFileSync(new URL('../../scraper-support/tests/fixtures/talentSprintNative20261026/careers.html', import.meta.url), 'utf8')

test('TalentSprint legacy fetchText transport retains native failure as an incomplete coverage gap', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Fixture test must not reach the network'))
  const requestedUrls = []
  const checkedAt = '2026-10-26T19:40:02.054Z'
  const scraper = createTalentSprintScraper({
    now: () => checkedAt,
    sleep: async () => {},
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_PAGE_URL) return verifiedCareersPage
      assert.equal(url, OFFICIAL_CAREERS_HANDOFF_URL)
      throw Object.assign(new Error('HTTP 500'), { status: 500 })
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_PAGE_URL, OFFICIAL_CAREERS_HANDOFF_URL])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.deepEqual(evidence, {
    status: 'coverage-gap', surface: OFFICIAL_CAREERS_HANDOFF_URL,
    firstParty: true, listingComplete: false, pagesFetched: 0,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: checkedAt,
    reason: 'native-public-route-unavailable;native-closing-state-unverified',
  })
  assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: checkedAt }), false)
})
