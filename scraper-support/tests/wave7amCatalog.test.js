import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadCatalog = async (relativePath, constantName) => {
  try {
    const module = await import(relativePath)
    return {
      constant: module[constantName],
      defaultExport: module.default,
    }
  } catch {
    assert.fail(`Expected catalog module at ${relativePath}`)
  }
}

const assertCatalogMatchesBacklogRow = ({ provider, companyName, modulePath }) => {
  assert.equal(provider.companyName, companyName)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.modulePath, modulePath)

  const report = generateCompanyCoverageReport({
    csvText: `${companyName}\n`,
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
}

const assertHydratedCatalogLoadsScript = async (provider) => {
  const module = await import(pathToFileURL(provider.modulePath).href)
  assert.equal(typeof module.run, 'function')
}

test('Muvi Entertainment local catalog captures the verified first-party paginated careers surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/muvientertainment/catalog.js',
    'MUVI_ENTERTAINMENT_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'muvientertainment')
  assert.equal(provider.officialBrandName, 'Muvi')
  assert.equal(provider.homepageUrl, 'https://www.muvi.com/')
  assert.equal(provider.companyCareerPage, 'https://www.muvi.com/career/')
  assert.equal(provider.atsPlatform, 'first-party-careers-pagination-plus-job-details')
  assert.equal(provider.paginationStrategy, 'complete-first-party-numbered-listing-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-handoff+all-listing-pages+validated-job-details+explicit-india-scope',
  )
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.match(provider.verifiedSurfaceSummary, /Automation Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /fail.closed/i)
  assert.equal(provider.verifiedPublicJobCount, 3)
  assert.equal(Object.hasOwn(provider, 'verifiedIndiaJobCount'), false)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Muvi Entertainment',
    modulePath: path.resolve(currentDir, '../../scraper/muvientertainment/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('A3logics local catalog captures the verified first-party careers page and Keka handoff', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/a3logics/catalog.js',
    'A3LOGICS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'a3logics')
  assert.equal(provider.companyName, 'A3logics')
  assert.equal(provider.officialBrandName, 'A3Logics')
  assert.equal(provider.homepageUrl, 'https://www.a3logics.com/')
  assert.equal(provider.companyCareerPage, 'https://www.a3logics.com/careers/')
  assert.equal(provider.jobsBoardUrl, 'https://a3logics.keka.com/careers/')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+keka-embed-handoff+active-jobs-api',
  )
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /Explore Job opportunities/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior System and Network Administrator in Jaipur/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'A3logics',
    modulePath: path.resolve(currentDir, '../../scraper/a3logics/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Calsoft local catalog captures the verified zero-openings first-party surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/calsoft/catalog.js',
    'CALSOFT_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'calsoft')
  assert.equal(provider.companyName, 'Calsoft')
  assert.equal(provider.officialBrandName, 'Calsoft')
  assert.equal(provider.homepageUrl, 'https://www.calsoftinc.com/')
  assert.equal(provider.companyCareerPage, 'https://www.calsoftinc.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers-zero-openings')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+zero-public-openings',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Open vacancies/i)
  assert.match(provider.verifiedSurfaceSummary, /No jobs found/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Calsoft',
    modulePath: path.resolve(currentDir, '../../scraper/calsoft/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Tudip Technologies local catalog captures the verified India-tab jobs board', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/tudiptechnologies/catalog.js',
    'TUDIP_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'tudiptechnologies')
  assert.equal(provider.officialBrandName, 'Tudip')
  assert.equal(provider.homepageUrl, 'https://tudip.com/')
  assert.equal(provider.companyCareerPage, 'https://tudip.com/jobs/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+category-filtered-job-listings',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Korean Language Expert/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Analyst/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Tudip Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/tudiptechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
