import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import {
  HOMEPAGE_URL,
  createSimpleEnergyScraper,
  hasOfficialHomepageSignal,
} from '../scraper/simpleenergy/script.js'

const officialHomepageHtml = `
  <main>
    <h1>Simple Energy</h1>
    <p>Simple One</p>
    <p>Corporate Identification Number (CIN) U29309KA2019PTC127859</p>
  </main>
`

test('Simple Energy resolves only from its exact CSV company name', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSimple Energy\nSimple Energy Pvt Ltd\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Simple Energy', 'simpleenergy', 'Simple Energy']],
  )
  assert.equal(report.unmatched[0].companyName, 'Simple Energy Pvt Ltd')
})

test('Simple Energy fails closed without a verified first-party homepage signature', async () => {
  assert.equal(hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal('<h1>Simple Energy</h1>'), false)

  const scraper = createSimpleEnergyScraper()
  await assert.rejects(
    scraper.run({ fetchText: async () => '<h1>Simple Energy</h1>' }),
    /no longer matches the verified first-party surface/i,
  )
})

test('Simple Energy returns no jobs while its verified official site exposes no public careers surface', async () => {
  const jobs = await createSimpleEnergyScraper().run({
    fetchText: async (url) => {
      assert.equal(url, HOMEPAGE_URL)
      return officialHomepageHtml
    },
  })

  assert.deepEqual(jobs, [])
})
