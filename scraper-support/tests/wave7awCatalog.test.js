import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

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

test('Velocity Software Solutions local catalog captures the verified first-party careers index and detail-page flow', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/velocitysoftwaresolutions/catalog.js',
    'VELOCITY_SOFTWARE_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'velocitysoftwaresolutions')
  assert.equal(provider.officialBrandName, 'Velocity')
  assert.equal(provider.homepageUrl, 'https://www.velsof.com/')
  assert.equal(provider.companyCareerPage, 'https://www.velsof.com/careers/')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-detail-pages')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-index-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-index+job-post-detail-pages+india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /UI\/UX Designer/i)
  assert.match(provider.verifiedSurfaceSummary, /Flutter Mobile App Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Laravel Developer/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Velocity Software Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/velocitysoftwaresolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Lavender Technology local catalog captures the verified exact-name homepage and fail-closed no-careers contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/lavendertechnology/catalog.js',
    'LAVENDER_TECHNOLOGY_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'lavendertechnology')
  assert.equal(provider.officialBrandName, 'Lavender Technologies')
  assert.equal(provider.homepageUrl, 'https://lavendertechnologies.com/')
  assert.equal(provider.companyCareerPage, 'https://lavendertechnologies.com/')
  assert.equal(provider.atsPlatform, 'first-party-homepage-without-public-careers-surface')
  assert.equal(provider.paginationStrategy, 'homepage-only-no-careers-or-jobs-surface')
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+no-public-careers-surface+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Home About Products Contact Get Quote/i)
  assert.match(provider.verifiedSurfaceSummary, /no public careers or jobs page/i)
  assert.match(provider.verifiedSurfaceSummary, /Alappuzha, Kerala, India/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Lavender Technology',
    modulePath: path.resolve(currentDir, '../../scraper/lavendertechnology/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Bitwise Solutions local catalog captures the verified exact-name careers page and explicit no-openings state', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/bitwisesolutions/catalog.js',
    'BITWISE_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'bitwisesolutions')
  assert.equal(provider.officialBrandName, 'Bitwise')
  assert.equal(provider.homepageUrl, 'https://www.bitwiseglobal.com/')
  assert.equal(provider.companyCareerPage, 'https://www.bitwiseglobal.com/company/careers')
  assert.equal(provider.openingsPageUrl, 'https://www.bitwiseglobal.com/company/careers/openings')
  assert.equal(provider.atsPlatform, 'first-party-current-openings-page-no-openings')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-current-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+current-openings-page-explicitly-no-openings',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /View Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /No openings found/i)
  assert.match(provider.verifiedSurfaceSummary, /bitwiseglobal\.com\/company\/careers\/openings/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Bitwise Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/bitwisesolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Wissen Technology local catalog captures the verified first-party openings page and contact handoff', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/wissentechnology/catalog.js',
    'WISSEN_TECHNOLOGY_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'wissentechnology')
  assert.equal(provider.officialBrandName, 'Wissen')
  assert.equal(provider.homepageUrl, 'https://www.wissen.com/')
  assert.equal(provider.companyCareerPage, 'https://www.wissen.com/career/opportunities-wissen-technology')
  assert.equal(provider.contactPageUrl, 'https://www.wissen.com/contact/writetous')
  assert.equal(provider.atsPlatform, 'first-party-webflow-openings-page-with-contact-handoff')
  assert.equal(provider.paginationStrategy, 'single-first-party-webflow-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-webflow-openings-page+cms-job-items+detail-route-deduping+write-to-us-contact-handoff',
  )
  assert.equal(provider.verifiedOn, '2026-08-06')
  assert.match(provider.verifiedSurfaceSummary, /Senior Level Java Technical Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Architect/i)
  assert.match(provider.verifiedSurfaceSummary, /www\.wissen\.com\/contact\/writetous/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Wissen Technology',
    modulePath: path.resolve(currentDir, '../../scraper/wissentechnology/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Cloud4C local catalog captures the verified exact-name careers page and generic application-form fallback sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/cloud4c/catalog.js',
    'CLOUD4C_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'cloud4c')
  assert.equal(provider.officialBrandName, 'Cloud4C')
  assert.equal(provider.homepageUrl, 'https://www.cloud4c.com/')
  assert.equal(provider.companyCareerPage, 'https://www.cloud4c.com/careers')
  assert.equal(provider.applicationFormUrl, 'https://www.cloud4c.com/applicant-form/careers')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-generic-application-form')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-generic-application-form')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+generic-application-form-without-public-openings+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Apply Now/i)
  assert.match(provider.verifiedSurfaceSummary, /Job Title/i)
  assert.match(provider.verifiedSurfaceSummary, /no public opening list/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Cloud4C',
    modulePath: path.resolve(currentDir, '../../scraper/cloud4c/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
