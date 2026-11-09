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

test('Facile Services local catalog captures the verified first-party careers table surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/facileservices/catalog.js',
    'FACILE_SERVICES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'facileservices')
  assert.equal(provider.officialBrandName, 'Facile Services')
  assert.equal(provider.homepageUrl, 'https://www.facileserv.com/')
  assert.equal(provider.companyCareerPage, 'https://www.facileserv.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-static-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+static-job-table-data-jdesc',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Content Writer/i)
  assert.match(provider.verifiedSurfaceSummary, /Voice and Accent Trainer/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Facile Services',
    modulePath: path.resolve(currentDir, '../../scraper/facileservices/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Helm360 local catalog captures the verified Indeed handoff-only first-party surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/helm360/catalog.js',
    'HELM360_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'helm360')
  assert.equal(provider.officialBrandName, 'Helm360')
  assert.equal(provider.companyCareerPage, 'https://helm360.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-third-party-handoff-only')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+indeed-handoff-only+no-first-party-job-list',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Search Open Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Indeed/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Helm360',
    modulePath: path.resolve(currentDir, '../../scraper/helm360/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('bluCognition local catalog captures the verified first-party careers JSON feed', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/blucognition/catalog.js',
    'BLUCOGNITION_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'blucognition')
  assert.equal(provider.companyName, 'bluCognition')
  assert.equal(provider.officialBrandName, 'bluCognition')
  assert.equal(provider.companyCareerPage, 'https://www.blucognition.com/careers/')
  assert.equal(provider.jobsApiUrl, 'https://www.blucognition.com/careers.txt')
  assert.equal(provider.atsPlatform, 'first-party-json-feed')
  assert.equal(provider.paginationStrategy, 'single-json-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+first-party-careers-json-feed',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Analyst - AML & KYC/i)
  assert.match(provider.verifiedSurfaceSummary, /Intern - Software Engineer/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'bluCognition',
    modulePath: path.resolve(currentDir, '../../scraper/blucognition/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Danske IT local catalog captures the verified transition notice and parent-brand careers surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/danskeit/catalog.js',
    'DANSKE_IT_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'danskeit')
  assert.equal(provider.companyName, 'Danske IT')
  assert.equal(provider.supportingEvidenceUrl, 'https://danskebank.com/news-and-insights/news-archive/press-releases/2023/pr26062023')
  assert.equal(provider.companyCareerPage, 'https://danskebank.com/careers')
  assert.equal(provider.atsPlatform, 'legacy-brand-no-exact-name-public-careers')
  assert.equal(provider.paginationStrategy, 'parent-brand-careers-page-plus-legacy-transition-notice')
  assert.equal(
    provider.extractionStrategy,
    'verified-parent-brand-careers-page+verified-legacy-sale-notice+no-exact-name-public-jobs-surface',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /June 26, 2023/i)
  assert.match(provider.verifiedSurfaceSummary, /transfer colleagues/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Danske IT',
    modulePath: path.resolve(currentDir, '../../scraper/danskeit/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Atidiv local catalog captures the verified server-rendered current openings surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/atidiv/catalog.js',
    'ATIDIV_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'atidiv')
  assert.equal(provider.officialBrandName, 'Atidiv')
  assert.equal(provider.companyCareerPage, 'https://atidiv.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-static-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+static-current-openings-links',
  )
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/atidiv\.com\/job\/senior-campaign-manager\//i)
  assert.match(provider.verifiedSurfaceSummary, /Digital Marketing/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Atidiv',
    modulePath: path.resolve(currentDir, '../../scraper/atidiv/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
