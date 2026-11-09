import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Giottus is registered as an exact-company provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'giottus')
  const scraper = buildScrapers().find((item) => item.name === 'giottus')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Giottus')
  assert.equal(provider.companyDomain, 'giottus.com')
  assert.equal(provider.companyCareerPage, 'https://www.giottus.com/')
  assert.equal(provider.source, 'giottus')
  assert.match(scraper.dryRunFile, /giottus[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nGiottus\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map(({ companyName, source, provider: matchedProvider }) => [
      companyName,
      source,
      matchedProvider?.companyName,
    ]),
    [['Giottus', 'giottus', 'Giottus']],
  )
})

test('Giottus fails closed on an unavailable native surface', async () => {
  const giottus = await import('../../scraper/giottus/script.js')

  assert.equal(giottus.SOURCE, 'giottus')
  assert.equal(giottus.COMPANY, 'Giottus')
  assert.equal(giottus.FIRST_PARTY_ROOT_URL, 'https://www.giottus.com/')
  await assert.rejects(giottus.run({fetchImpl:async()=>{throw new Error('unavailable')}}),{code:'GIOTTUS_COVERAGE_GAP'})
})

