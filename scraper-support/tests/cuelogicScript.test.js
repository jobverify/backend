import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import {
  buildSearchRequestPayload,
  buildSearchUrl,
  createCuelogicScraper,
  SEARCH_TERM,
} from '../../scraper/cuelogic/script.js'

const page = (total) => `<JobPageVO><startJobIndex>0</startJobIndex><maxJobSize>10</maxJobSize><totalJobCount>${total}</totalJobCount>${total ? '<jobVoList><jobSeq>898694</jobSeq></jobVoList>' : '<jobVoList/>'}</JobPageVO>`

const fetchText = async (url, options) => {
  assert.equal(url, buildSearchUrl())
  assert.equal(options.method, 'POST')
  const payload = JSON.parse(new URLSearchParams(options.body).get('careerSiteUrlParams'))
  assert.equal(payload.geo, 'India')
  return page(payload.search === '*:*' ? 1 : 0)
}

test('Cuelogic searches the current official LTM Ripplehire India board', () => {
  assert.equal(SEARCH_TERM, 'Cuelogic')
  assert.equal(buildSearchUrl(), 'https://ltimindtree.ripplehire.com/candidate/candidatejobsearch')
  assert.deepEqual(buildSearchRequestPayload(), {
    page: 0, search: 'Cuelogic', token: 'xviyQvbnyYZdGtozXoNm', source: 'CAREERSITE', pagesize: 10, geo: 'India',
  })
})

test('Cuelogic records verified empty inventory when parent board works but has no matching India jobs', async () => {
  const jobs = await createCuelogicScraper({ now: () => '2026-10-03T00:00:00.000Z' }).run({ fetchText })
  assert.deepEqual(jobs, [])
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'verified-empty',
    surface: buildSearchUrl(),
    firstParty: true,
    listingComplete: true,
    pagesFetched: 2,
    reportedTotal: 0,
    indiaFacetCount: 0,
    verifiedAt: '2026-10-03T00:00:00.000Z',
    reason: 'cuelogic-ltm-ripplehire-india-search-zero',
  })
})

test('Cuelogic fails closed when matching roles appear or parent API is incomplete', async () => {
  await assert.rejects(
    createCuelogicScraper().run({ fetchText: async () => page(1) }),
    /matching jobs/i,
  )
  await assert.rejects(
    createCuelogicScraper().run({ fetchText: async () => '<html>Maintenance</html>' }),
    /changed/i,
  )
  await assert.rejects(
    createCuelogicScraper().run({ fetchText: async () => page(0) }),
    /no control results/i,
  )
})
