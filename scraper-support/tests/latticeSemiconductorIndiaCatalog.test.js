import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/latticesemiconductorindia/catalog.js')
  } catch {
    assert.fail('Expected Lattice Semiconductor India catalog module at ../../scraper/latticesemiconductorindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/latticesemiconductorindia/script.js')
  } catch {
    assert.fail('Expected Lattice Semiconductor India scraper module at ../../scraper/latticesemiconductorindia/script.js')
  }
}

test('Lattice Semiconductor India catalog captures the verified first-party Workday contract', async () => {
  const {
    LATTICE_SEMICONDUCTOR_INDIA_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const lattice = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LATTICE_SEMICONDUCTOR_INDIA_CATALOG)

  assert.equal(defaultCatalog, LATTICE_SEMICONDUCTOR_INDIA_CATALOG)
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.source, 'latticesemiconductorindia')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.companyName, 'Lattice Semiconductor India')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.officialBrandName, 'Lattice Semiconductor')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.adapter, 'script')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.modulePath, '../../scraper/latticesemiconductorindia/script.js')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.dryRunFile, 'latticesemiconductorindia/jobs.json')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.homepageUrl, 'https://www.latticesemi.com/en')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.companyCareerPage, 'https://www.latticesemi.com/About/Jobs')
  assert.equal(
    LATTICE_SEMICONDUCTOR_INDIA_CATALOG.workdayBoardUrl,
    'https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers',
  )
  assert.equal(
    LATTICE_SEMICONDUCTOR_INDIA_CATALOG.workdayJobsApiUrl,
    'https://latticesemi.wd5.myworkdayjobs.com/wday/cxs/latticesemi/latticesemiconductorscareers/jobs',
  )
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.atsPlatform, 'workday-jobs-api')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.paginationStrategy, 'workday-jobs-api')
  assert.equal(
    LATTICE_SEMICONDUCTOR_INDIA_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-workday-handoff+verified-workday-board+jobs-api',
  )
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.companyDomain, 'latticesemi.com')
  assert.equal(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.verifiedOn, '2026-08-15')
  assert.match(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.latticesemi\.com\/About\/Jobs/i)
  assert.match(
    LATTICE_SEMICONDUCTOR_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/latticesemi\.wd5\.myworkdayjobs\.com\/latticesemiconductorscareers/i,
  )
  assert.match(
    LATTICE_SEMICONDUCTOR_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/latticesemi\.wd5\.myworkdayjobs\.com\/wday\/cxs\/latticesemi\/latticesemiconductorscareers\/jobs/i,
  )
  assert.match(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.verifiedSurfaceSummary, /Design Eng/i)
  assert.match(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.verifiedSurfaceSummary, /Senior Design Verification Engineer/i)
  assert.match(LATTICE_SEMICONDUCTOR_INDIA_CATALOG.verifiedSurfaceSummary, /Intellectual Property Counsel/i)

  assert.equal(provider.source, 'latticesemiconductorindia')
  assert.equal(provider.companyName, 'Lattice Semiconductor India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.latticesemi.com/About/Jobs')
  assert.equal(provider.companyDomain, 'latticesemi.com')
  assert.match(provider.modulePath, /latticesemiconductorindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /latticesemiconductorindia[\\/]jobs\.json$/i)

  assert.equal(lattice.PROVIDER_METADATA.source, provider.source)
  assert.equal(lattice.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(lattice.OFFICIAL_CAREERS_PAGE_URL, provider.companyCareerPage)
  assert.equal(lattice.OFFICIAL_WORKDAY_BOARD_URL, provider.workdayBoardUrl)
  assert.equal(lattice.WORKDAY_JOBS_API_URL, provider.workdayJobsApiUrl)
})

test('Lattice Semiconductor India exact-name backlog rows resolve directly from the local provider metadata', async () => {
  const { LATTICE_SEMICONDUCTOR_INDIA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Lattice Semiconductor India\n',
    catalog: [hydrateProviderCatalogEntry(LATTICE_SEMICONDUCTOR_INDIA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lattice Semiconductor India', 'latticesemiconductorindia', 'Lattice Semiconductor India']],
  )
})
