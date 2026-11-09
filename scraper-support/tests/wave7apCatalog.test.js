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

test('Diksha Technologies local catalog captures the verified paginated first-party careers surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/dikshatechnologies/catalog.js',
    'DIKSHA_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'dikshatechnologies')
  assert.equal(provider.officialBrandName, 'Diksha')
  assert.equal(provider.homepageUrl, 'https://dikshatech.com/')
  assert.equal(provider.companyCareerPage, 'https://dikshatech.com/join-diksha-now/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'first-party-query-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-job-cards+query-pagination',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Tech Support/i)
  assert.match(provider.verifiedSurfaceSummary, /page=3/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Diksha Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/dikshatechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Amnet Systems local catalog captures the verified email-only first-party careers surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/amnetsystems/catalog.js',
    'AMNET_SYSTEMS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'amnetsystems')
  assert.equal(provider.companyName, 'Amnet Systems')
  assert.equal(provider.officialBrandName, 'Amnet')
  assert.equal(provider.homepageUrl, 'https://amnet.com/')
  assert.equal(provider.companyCareerPage, 'https://amnet.com/life-at-amnet/')
  assert.equal(provider.legacyCurrentOpeningsUrl, 'https://amnet-systems.com/about/life-at-amnet/current-openings/')
  assert.equal(provider.atsPlatform, 'official-company-careers-email-only')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-legacy-route-404')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+email-only-current-openings+legacy-route-404',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /careers@amnet\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Page not found/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Amnet Systems',
    modulePath: path.resolve(currentDir, '../../scraper/amnetsystems/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('DLT Lab Technologies local catalog captures the verified rebrand and blocked parent careers surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/dltlabtechnologies/catalog.js',
    'DLT_LAB_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'dltlabtechnologies')
  assert.equal(provider.companyName, 'DLT Lab Technologies')
  assert.equal(provider.officialBrandName, 'DLT Labs')
  assert.equal(provider.homepageUrl, 'https://www.dltlabs.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.knnx.com/jobs/Careers')
  assert.equal(
    provider.rebrandArticleUrl,
    'https://knnx.com/worlds-foremost-freight-and-logistics-software-innovator-reenergized-as-knnx-corp-formerly-dlt-labs/',
  )
  assert.equal(provider.atsPlatform, 'legacy-brand-blocked-parent-careers')
  assert.equal(provider.paginationStrategy, 'legacy-domain-redirect-plus-parent-careers-block-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-dltlabs-to-knnx-redirect+verified-rebrand-notice+blocked-parent-careers-surface',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /KNNX Corp/i)
  assert.match(provider.verifiedSurfaceSummary, /blocked/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'DLT Lab Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/dltlabtechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Wyzmindz Solutions local catalog captures the verified WordPress marketing site and missing career routes', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/wyzmindzsolutions/catalog.js',
    'WYZMINDZ_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'wyzmindzsolutions')
  assert.equal(provider.companyName, 'Wyzmindz Solutions')
  assert.equal(provider.officialBrandName, 'WyzMindz')
  assert.equal(provider.homepageUrl, 'https://wyzmindz.com/')
  assert.equal(provider.companyCareerPage, 'https://wyzmindz.com/')
  assert.equal(provider.contactPageUrl, 'https://wyzmindz.com/contact/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.paginationStrategy, 'homepage-plus-contact-page-plus-common-route-404-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-wordpress-homepage+verified-contact-form+missing-common-career-routes-return-404',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Get in touch/i)
  assert.match(provider.verifiedSurfaceSummary, /Page not found/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Wyzmindz Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/wyzmindzsolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Sedin Technologies local catalog captures the verified first-party careers page and live job cards', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/sedintechnologies/catalog.js',
    'SEDIN_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'sedintechnologies')
  assert.equal(provider.companyName, 'Sedin Technologies')
  assert.equal(provider.officialBrandName, 'Sedin Technologies')
  assert.equal(provider.homepageUrl, 'https://sedintechnologies.com/')
  assert.equal(provider.companyCareerPage, 'https://sedintechnologies.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-job-cards+third-party-zoho-apply-links',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Odoo Pre Sales/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Polyglot Developer/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Sedin Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/sedintechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
