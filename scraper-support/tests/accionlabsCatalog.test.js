import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAccionLabsModule = async () => {
  try {
    return await import('../../scraper/accionlabs/script.js')
  } catch {
    return null
  }
}

test('Accion Labs exports native role discovery metadata with unresolved whole inventory for the current first-party careers surface', async () => {
  const accionLabs = await loadAccionLabsModule()
  assert.ok(accionLabs, 'Expected Accion Labs scraper module at ../../scraper/accionlabs/script.js')

  assert.equal(accionLabs.SOURCE, 'accionlabs')
  assert.equal(accionLabs.COMPANY, 'Accion Labs')
  assert.equal(accionLabs.COMPANY_DOMAIN, 'accionlabs.com')
  assert.equal(accionLabs.VERIFIED_AT, null)
  assert.equal(accionLabs.HOMEPAGE_URL, 'https://www.accionlabs.com/')
  assert.equal(accionLabs.CAREERS_URL, 'https://www.accionlabs.com/careers')
  assert.equal(accionLabs.US_OPPORTUNITIES_URL, 'https://www.accionlabs.com/us-opportunities')
  assert.equal(
    accionLabs.PRAGUE_ENGINEERING_CENTER_URL,
    'https://www.accionlabs.com/prague-engineering-center',
  )
  assert.equal(accionLabs.SCRAPER_METADATA.atsPlatform, 'official-company-native-postings')
  assert.match(accionLabs.SCRAPER_METADATA.extractionStrategy, /typed-native-employer.*typed-country-only/)
  assert.equal(accionLabs.SCRAPER_METADATA.verifiedPublicJobCount, null)
  assert.equal(accionLabs.SCRAPER_METADATA.verifiedIndiaJobCount, null)
  assert.equal(accionLabs.SCRAPER_METADATA.sourceScopeComplete, false)
  assert.equal(accionLabs.SCRAPER_METADATA.lifecycleCleanupAllowed, false)
})

test('buildScrapers and company coverage resolve Accion Labs from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'accionlabs')
  const scraper = buildScrapers().find((item) => item.name === 'accionlabs')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Accion Labs')
  assert.equal(provider.companyCareerPage, 'https://www.accionlabs.com/careers')
  assert.match(scraper.dryRunFile, /accionlabs[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Accion Labs\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Accion Labs', 'accionlabs', 'Accion Labs']],
  )
})
