import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadNativeOrangeModule = async () => {
  try {
    return await import('../../scraper/nativeorange/script.js')
  } catch {
    assert.fail('Expected Native orange scraper module at ../../scraper/nativeorange/script.js')
  }
}

test('Native orange provider metadata stays pinned to the Thursday, August 13, 2026 marketing-shell no-public-jobs surface', async () => {
  const nativeorange = await loadNativeOrangeModule()
  const provider = getScraperCatalog().find((item) => item.source === 'nativeorange')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Native orange')
  assert.equal(provider.companyCareerPage, 'https://nativeorange.ai/about/')
  assert.equal(provider.homepageUrl, 'https://nativeorange.ai/')
  assert.equal(provider.contactPageUrl, 'https://nativeorange.ai/contact/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(
    provider.verifiedSurfaceSummary,
    /agentic underwriting to claims on one platform/i,
  )
  assert.equal(nativeorange.CONTACT_URL, provider.contactPageUrl)
})

test('Native orange backlog row resolves directly from the provider metadata without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nativeorange')
  const report = generateCompanyCoverageReport({
    csvText: 'Native orange\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Native orange', 'nativeorange', 'Native orange']],
  )
})

test('buildScrapers exposes a runnable Native orange scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nativeorange')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nativeorange')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /nativeorange[\\/]jobs\.json$/i)
})
