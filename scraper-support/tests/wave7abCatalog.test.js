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

test('Cognus Technology local catalog captures the verified first-party homepage handoff and Zoho careers board', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/cognustechnology/catalog.js',
    'COGNUS_TECHNOLOGY_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'cognustechnology')
  assert.equal(provider.officialBrandName, 'Cognus Technology')
  assert.equal(provider.homepageUrl, 'https://www.cognustechnology.com/')
  assert.equal(provider.companyCareerPage, 'https://cognustechnology.zohorecruit.in/jobs/Careers')
  assert.equal(provider.atsPlatform, 'zoho-recruit-careers-site')
  assert.equal(provider.paginationStrategy, 'single-hidden-input-json-payload')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+official-zoho-careers-hidden-input-jobs-payload',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Join Us/i)
  assert.match(provider.verifiedSurfaceSummary, /Find the career of your dreams/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Manager/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Cognus Technology',
    modulePath: path.resolve(currentDir, '../../scraper/cognustechnology/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('SAG Infotech local catalog captures the verified static first-party current openings page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/saginfotech/catalog.js',
    'SAG_INFOTECH_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'saginfotech')
  assert.equal(provider.officialBrandName, 'SAG Infotech')
  assert.equal(provider.companyCareerPage, 'https://saginfotech.com/career.aspx')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-static-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+static-current-openings-cards',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /ApplyCareer\.aspx\?code=0023/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'SAG Infotech',
    modulePath: path.resolve(currentDir, '../../scraper/saginfotech/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Intech Creative Services local catalog captures the verified INTECH loop-grid careers page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/intechcreativeservices/catalog.js',
    'INTECH_CREATIVE_SERVICES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'intechcreativeservices')
  assert.equal(provider.officialBrandName, 'The INTECH Group')
  assert.equal(provider.companyCareerPage, 'https://theintechgroup.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'elementor-load-more-pages+published-rest-count')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-paged-cards+published-identity-inventory+native-job-details',
  )
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.match(provider.verifiedSurfaceSummary, /At INTECH Creative Services/i)
  assert.match(provider.verifiedSurfaceSummary, /coverage-gap/i)
  assert.equal(provider.verifiedPublishedJobCount, 23)
  assert.equal(provider.verifiedIndiaJobCount, 20)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Intech Creative Services',
    modulePath: path.resolve(currentDir, '../../scraper/intechcreativeservices/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Mindfire Solutions local catalog captures the verified first-party shell and public jobpost API', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/mindfiresolutions/catalog.js',
    'MINDFIRE_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'mindfiresolutions')
  assert.equal(provider.officialBrandName, 'Mindfire Solutions')
  assert.equal(
    provider.companyCareerPage,
    'https://www.mindfiresolutions.com/life-at-mindfire-people-culture-career-opportunities/career/',
  )
  assert.equal(provider.jobsApiUrl, 'https://apply.mindfiresolutions.com/api/jobpost')
  assert.equal(provider.atsPlatform, 'mindfire-public-api')
  assert.equal(provider.paginationStrategy, 'single-jobpost-api-payload')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+official-public-jobpost-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Career Possibilities/i)
  assert.match(provider.verifiedSurfaceSummary, /apply\.mindfiresolutions\.com\/api\/jobpost/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Mindfire Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/mindfiresolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Hidden Brains InfoTech local catalog captures the verified ALL POSITIONS careers page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/hiddenbrainsinfotech/catalog.js',
    'HIDDEN_BRAINS_INFOTECH_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'hiddenbrainsinfotech')
  assert.equal(provider.officialBrandName, 'Hidden Brains Infotech Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.hiddenbrains.com/careers.html')
  assert.equal(provider.atsPlatform, 'official-nextjs-careers-page')
  assert.equal(provider.paginationStrategy, 'single-visible-all-positions-list')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+visible-all-positions-job-cards',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /ALL POSITIONS/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Executive/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Hidden Brains InfoTech',
    modulePath: path.resolve(currentDir, '../../scraper/hiddenbrainsinfotech/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
