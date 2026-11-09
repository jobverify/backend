import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCelebalModule = async () => {
  try {
    return await import('../../scraper/celebaltechnologies/script.js')
  } catch {
    return null
  }
}

test('getScraperCatalog includes Celebal Technologies as a verified first-party bundle scraper', async () => {
  const celebal = await loadCelebalModule()
  assert.ok(celebal, 'Expected Celebal Technologies scraper module at ../../scraper/celebaltechnologies/script.js')
  const provider = getScraperCatalog().find((item) => item.source === 'celebaltechnologies')

  assert.ok(provider)
  assert.equal(provider.source, 'celebaltechnologies')
  assert.equal(provider.companyName, 'Celebal Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://celebaltech.com/careers')
  assert.equal(provider.companyDomain, 'celebaltech.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.atsPlatform, 'nextjs-first-party-bundle')
  assert.equal(provider.paginationStrategy, 'client-side-pagination-from-public-nextjs-jobs-bundle')
  assert.equal(provider.extractionStrategy, 'official-careers-html+public-nextjs-chunk-dataset')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /first-party careers surface/i)
  assert.match(provider.modulePath, /celebaltechnologies[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /celebaltechnologies[\\/]jobs\.json$/i)

  assert.equal(celebal.SOURCE, 'celebaltechnologies')
  assert.equal(celebal.COMPANY, 'Celebal Technologies')
  assert.equal(celebal.VERIFIED_AT, '2026-07-14')
  assert.equal(celebal.CAREERS_URL, 'https://celebaltech.com/careers')
  assert.equal(celebal.CAREERS_SITE_ORIGIN, 'https://celebaltech.com')
  assert.deepEqual(celebal.PAGE_ONE_REQUIRED_ROLE_IDS, [
    'data-scientist-fresher',
    'data-engineer-fresher',
    'data-engineer',
  ])
  assert.deepEqual(celebal.SCRAPER_METADATA, {
    source: 'celebaltechnologies',
    companyName: 'Celebal Technologies',
    companyCareerPage: 'https://celebaltech.com/careers',
    companyDomain: 'celebaltech.com',
    countryFilter: 'India',
    atsPlatform: 'nextjs-first-party-bundle',
    paginationStrategy: 'client-side-pagination-from-public-nextjs-jobs-bundle',
    extractionStrategy: 'official-careers-html+public-nextjs-chunk-dataset',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
  })
  assert.equal(
    celebal.buildDetailUrl('technical-project-manager'),
    'https://celebaltech.com/careers/technical-project-manager',
  )
})

test('buildScrapers and company coverage resolve Celebal and Celebal Technologies from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'celebaltechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'celebaltechnologies')
  assert.match(scraper.dryRunFile, /celebaltechnologies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Celebal,\nCelebal Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Celebal', 'celebaltechnologies', 'Celebal Technologies'],
      ['Celebal Technologies', 'celebaltechnologies', 'Celebal Technologies'],
    ],
  )
})
