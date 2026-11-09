import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/aaravunmannedsystems/provider.js')
  } catch {
    return null
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/aaravunmannedsystems/script.js')
  } catch {
    return null
  }
}

test('Aarav Unmanned Systems exports local provider metadata for the verified first-party Aereo careers surface', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.ok(
    providerModule,
    'Expected Aarav Unmanned Systems provider module at ../../scraper/aaravunmannedsystems/provider.js',
  )
  assert.ok(
    scriptModule,
    'Expected Aarav Unmanned Systems scraper module at ../../scraper/aaravunmannedsystems/script.js',
  )

  assert.deepEqual(providerModule.provider, {
    source: 'aaravunmannedsystems',
    companyName: 'Aarav Unmanned Systems',
    adapter: 'script',
    modulePath: '../../scraper/aaravunmannedsystems/script.js',
    companyCareerPage: 'https://aereo.io/careers/',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'verified-about-page-plus-careers-landing-plus-first-party-hiring-board',
    extractionStrategy:
      'verified-aereo-rebrand-about-page+verified-careers-handoff+first-party-hiring-board-inline-job-cards',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'aereo.io',
    verifiedOn: '2026-07-14',
    verifiedSurfaceSummary:
      'Verified https://aereo.io/about/ identifies Aereo as formerly known as Aarav Unmanned Systems, https://aereo.io/careers/ hands job seekers to the first-party hiring board at https://hire.aereonauts.aereo.io/, and that board exposes public openings with first-party company_career detail links.',
    dryRunFile: 'aaravunmannedsystems/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('buildScrapers and company coverage resolve Aarav Unmanned Systems from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aaravunmannedsystems')
  const scraper = buildScrapers().find((item) => item.name === 'aaravunmannedsystems')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aarav Unmanned Systems')
  assert.equal(provider.companyCareerPage, 'https://aereo.io/careers/')
  assert.match(scraper.dryRunFile, /aaravunmannedsystems[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aarav Unmanned Systems\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aarav Unmanned Systems', 'aaravunmannedsystems', 'Aarav Unmanned Systems']],
  )
})
