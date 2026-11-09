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

test('NextComm Corporation local catalog captures the verified parking-lander fail-closed contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/nextcommcorporation/catalog.js',
    'NEXTCOMM_CORPORATION_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'nextcommcorporation')
  assert.equal(provider.companyCareerPage, 'https://www.nextcommcorporation.com/careers')
  assert.equal(provider.landerUrl, 'https://www.nextcommcorporation.com/lander')
  assert.equal(provider.atsPlatform, 'official-site-parking-lander-sentinel')
  assert.equal(provider.paginationStrategy, 'homepage-and-careers-js-redirect-plus-lander-validation')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /GoDaddy parking lander/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'NextComm Corporation',
    modulePath: path.resolve(currentDir, '../../scraper/nextcommcorporation/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Mobileum local catalog captures the verified first-party careers iframe and public vacancies table', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/mobileum/catalog.js',
    'MOBILEUM_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'mobileum')
  assert.equal(provider.companyCareerPage, 'https://www.mobileum.com/about/careers-and-culture')
  assert.equal(provider.recruitPageUrl, 'https://mobileum-node.my.salesforce-sites.com/Recruit/')
  assert.equal(provider.atsPlatform, 'salesforce-applicant-portal')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-salesforce-vacancies-table')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Current Vacancies/i)
  assert.match(provider.verifiedSurfaceSummary, /Seattle/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Mobileum',
    modulePath: path.resolve(currentDir, '../../scraper/mobileum/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('StrategicERP local catalog captures the verified first-party visible position cards', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/strategicerp/catalog.js',
    'STRATEGIC_ERP_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'strategicerp')
  assert.equal(provider.companyCareerPage, 'https://www.strategicerp.com/careers.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.match(provider.verifiedSurfaceSummary, /job_details\.php\?id=3/i)
  assert.match(provider.verifiedSurfaceSummary, /Mumbai/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'StrategicERP',
    modulePath: path.resolve(currentDir, '../../scraper/strategicerp/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('McAfee local catalog captures the verified non-enumerable careers shell fail-closed contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/mcafee/catalog.js',
    'MCAFEE_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'mcafee')
  assert.equal(provider.companyCareerPage, 'https://careers.mcafee.com/join')
  assert.equal(provider.searchResultsUrl, 'https://careers.mcafee.com/global/en/search-results')
  assert.equal(provider.atsPlatform, 'jibe-jobs-api')
  assert.equal(provider.verifiedPublicJobCount, 5)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.match(provider.verifiedSurfaceSummary, /api\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Engineer \/ Analyst/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'McAfee',
    modulePath: path.resolve(currentDir, '../../scraper/mcafee/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Betsol local catalog captures the verified first-party linkout and public SmartRecruiters board', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/betsol/catalog.js',
    'BETSOL_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'betsol')
  assert.equal(provider.companyCareerPage, 'https://www.betsol.com/careers/')
  assert.equal(provider.boardUrl, 'https://careers.smartrecruiters.com/Betsol')
  assert.equal(provider.atsPlatform, 'smartrecruiters-public-postings-api')
  assert.equal(provider.paginationStrategy, 'complete-smartrecruiters-public-postings-api-with-board-count-check')
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Sixteen published postings are explicitly in India/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Betsol',
    modulePath: path.resolve(currentDir, '../../scraper/betsol/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
