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

test('Mobineers Info Systems local catalog captures the verified first-party careers inventory', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/mobineersinfosystems/catalog.js',
    'MOBINEERS_INFO_SYSTEMS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'mobineersinfosystems')
  assert.equal(provider.officialBrandName, 'Mobineers Info Systems Pvt. Ltd.')
  assert.equal(provider.homepageUrl, 'https://mobineers.com/')
  assert.equal(provider.companyCareerPage, 'https://mobineers.com/career/')
  assert.equal(provider.atsPlatform, 'first-party-careers-page')
  assert.equal(provider.paginationStrategy, 'single-first-party-listing-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+job-card-links+detail-pages',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr\. Sales Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Ass\. Sales Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Assistant Sales Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /QA Automation Tester/i)
  assert.match(provider.verifiedSurfaceSummary, /SQL DEVELOPER/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr\. Business Developer/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Mobineers Info Systems',
    modulePath: path.resolve(currentDir, '../../scraper/mobineersinfosystems/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('BUSINESSNEXT local catalog captures the verified first-party current openings table', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/businessnext/catalog.js',
    'BUSINESSNEXT_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'businessnext')
  assert.equal(provider.officialBrandName, 'BUSINESSNEXT')
  assert.equal(provider.homepageUrl, 'https://www.businessnext.com/')
  assert.equal(provider.careersHubUrl, 'https://careers.businessnext.com/default/index')
  assert.equal(provider.companyCareerPage, 'https://careers.businessnext.com/default/current_openings')
  assert.equal(provider.atsPlatform, 'first-party-current-openings-page')
  assert.equal(provider.paginationStrategy, 'single-first-party-current-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-home+current-openings-category-tables',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Lead - DevOps/i)
  assert.match(provider.verifiedSurfaceSummary, /Manager- DataScience/i)
  assert.match(provider.verifiedSurfaceSummary, /19 open positions/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'BUSINESSNEXT',
    modulePath: path.resolve(currentDir, '../../scraper/businessnext/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('RGBSI local catalog captures the verified exact-name SmartRecruiters board and India-empty filter contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/rgbsi/catalog.js',
    'RGBSI_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'rgbsi')
  assert.equal(provider.officialBrandName, 'RGBSI')
  assert.equal(provider.homepageUrl, 'https://www.rgbsi.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.smartrecruiters.com/RGBSI')
  assert.equal(provider.boardUrl, 'https://careers.smartrecruiters.com/RGBSI')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.equal(provider.paginationStrategy, 'exact-name-smartrecruiters-board-plus-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-smartrecruiters-board+official-homepage-link+smartrecruiters-jobs-api+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /CNC programmer/i)
  assert.match(provider.verifiedSurfaceSummary, /Supplier Quality Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /no India-visible openings/i)
  assert.match(provider.config.discovery.listingApiUrl, /api\.smartrecruiters\.com\/v1\/companies\/RGBSI\/postings/i)
  assert.match(provider.config.detail.urlTemplate, /api\.smartrecruiters\.com\/v1\/companies\/RGBSI\/postings\/\{\{jobId\}\}/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'RGBSI',
    modulePath: path.resolve(currentDir, '../../scraper/rgbsi/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('LocoNav local catalog captures the verified first-party LinkedIn handoff and fail-closed sentinel contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/loconav/catalog.js',
    'LOCONAV_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'loconav')
  assert.equal(provider.officialBrandName, 'LocoNav')
  assert.equal(provider.homepageUrl, 'https://loconav.com/')
  assert.equal(provider.companyCareerPage, 'https://loconav.com/career')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-linkedin-handoff')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+linkedin-handoff-without-first-party-job-list+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /See Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /LinkedIn/i)
  assert.match(provider.verifiedSurfaceSummary, /no first-party public jobs inventory/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Loconav',
    modulePath: path.resolve(currentDir, '../../scraper/loconav/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('IonIdea local catalog captures the verified first-party inline jobs page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/ionidea/catalog.js',
    'IONIDEA_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'ionidea')
  assert.equal(provider.officialBrandName, 'IonIdea')
  assert.equal(provider.homepageUrl, 'https://www.ionidea.com/')
  assert.equal(provider.companyCareerPage, 'https://www.ionidea.com/careers.php')
  assert.equal(provider.applyPageUrl, 'https://www.ionidea.com/careers-apply.php')
  assert.equal(provider.atsPlatform, 'first-party-inline-jobs-page')
  assert.equal(provider.paginationStrategy, 'single-first-party-inline-jobs-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+inline-role-sections+shared-apply-form',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /APM Consultant\/Sr Consultant for Dynatrace/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer - APM/i)
  assert.match(provider.verifiedSurfaceSummary, /Consultant \(Devops Engineer\)/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'IonIdea',
    modulePath: path.resolve(currentDir, '../../scraper/ionidea/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
