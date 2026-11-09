import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const officialHomepageHtml = `
  <html><head><title>Ditto Insurance</title></head>
  <body><a href="https://ditto.zappyhire.com/">Careers</a></body></html>
`

test('Ditto Insurance exact CSV name resolves to its provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nDitto Insurance\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'dittoinsurance')
  assert.equal(report.matched[0].provider.companyName, 'Ditto Insurance')
})

test('Ditto Insurance validates the official careers handoff and fails closed', async () => {
  const ditto = await import('../scraper/dittoinsurance/script.js')
  const provider = getScraperCatalog().find((item) => item.source === 'dittoinsurance')
  const scraper = buildScrapers().find((item) => item.name === 'dittoinsurance')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(ditto.hasVerifiedOfficialCareersHandoff(officialHomepageHtml), true)
  // The handoff alone no longer certifies an empty native inventory.
  // Keep the same weak homepage input at the actual transport-qualified boundary.
  const calls = []
  const options = {
    fetchText: async () => officialHomepageHtml,
    fetchPage: async (url) => { calls.push(url); return { status: 200, url, html: officialHomepageHtml } },
    fetchJson: async () => assert.fail('Unbound homepage input cannot authorize a native API read'),
  }
  for (const selected of [ditto.createDittoInsuranceScraper(), scraper]) {
    await assert.rejects(selected.run(options), /current executable main bundle binding unavailable/i)
  }
  assert.deepEqual(calls, [
    'https://joinditto.in/', 'https://ditto.zappyhire.com/',
    'https://joinditto.in/', 'https://ditto.zappyhire.com/',
  ])
})

test('Ditto Insurance rejects an untrusted careers surface', async () => {
  const ditto = await import('../scraper/dittoinsurance/script.js')

  const calls = []
  await assert.rejects(
    ditto.createDittoInsuranceScraper().run({
      fetchPage: async (url) => { calls.push(url); return { status: 200, url, html: '<html>Other company</html>' } },
      fetchJson: async () => assert.fail('An untrusted employer page cannot authorize a native API read'),
    }),
    /current employer careers handoff unavailable/i,
  )
  assert.deepEqual(calls, ['https://joinditto.in/'])
})
