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

test('Izmo local catalog captures the verified first-party izmocars careers board', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/izmo/catalog.js', 'IZMO_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'izmo')
  assert.equal(provider.companyName, 'Izmo')
  assert.equal(provider.officialBrandName, 'izmocars')
  assert.equal(provider.homepageUrl, 'https://www.goizmo.com/')
  assert.equal(provider.companyCareerPage, 'https://www.goizmo.com/careers')
  assert.equal(provider.atsPlatform, 'official-nextjs-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-opening-cards+same-domain-detail-links',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Build the Future of Automotive Tech/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Graphic Designer \(UK Process\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore, India \(BTM 2nd Stage\)/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Izmo',
    modulePath: path.resolve(currentDir, '../../scraper/izmo/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Cadsys local catalog captures the verified Cadensys careers page handoff', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/cadsys/catalog.js', 'CADSYS_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'cadsys')
  assert.equal(provider.companyName, 'Cadsys')
  assert.equal(provider.officialBrandName, 'Cadensys')
  assert.equal(provider.homepageUrl, 'https://www.cadensys.ai/')
  assert.equal(provider.companyCareerPage, 'https://www.cadensys.ai/careers/')
  assert.equal(provider.atsPlatform, 'official-static-careers-page')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-role-links+same-domain-detail-links',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Senior Data Scientist/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer, Backend/i)
  assert.match(provider.verifiedSurfaceSummary, /Remote \/ Hybrid/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Cadsys',
    modulePath: path.resolve(currentDir, '../../scraper/cadsys/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('NaviSite local catalog captures the verified blocked first-party Accenture handoff sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/navisite/catalog.js', 'NAVISITE_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'navisite')
  assert.equal(provider.companyName, 'NaviSite')
  assert.equal(provider.officialBrandName, 'Navisite, Part of Accenture')
  assert.equal(provider.homepageUrl, 'https://www.navisite.com/')
  assert.equal(provider.companyCareerPage, 'https://www.navisite.com/about/careers/')
  assert.equal(provider.parentCareersUrl, 'https://www.accenture.com/us-en/careers')
  assert.equal(provider.atsPlatform, 'official-careers-parent-search-handoff')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'first-party-handoff-page-or-blocked-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-navisite-handoff-or-cloudflare-blocked-shell+opaque-accenture-search-flow+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare "Just a moment\.\.\."/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 403/i)
  assert.match(provider.verifiedSurfaceSummary, /search "Navisite"/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'NaviSite',
    modulePath: path.resolve(currentDir, '../../scraper/navisite/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Scope eKnowledge Center local catalog captures the verified exact-name no-public-jobs sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/scopeeknowledgecenter/catalog.js',
    'SCOPE_EKNOWLEDGE_CENTER_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'scopeeknowledgecenter')
  assert.equal(provider.companyName, 'Scope eKnowledge Center')
  assert.equal(provider.officialBrandName, 'Scope e-Knowledge Center')
  assert.equal(provider.homepageUrl, 'https://www.scopeknowledge.com/')
  assert.equal(provider.companyCareerPage, 'https://www.scopeknowledge.com/')
  assert.equal(provider.atsPlatform, 'exact-name-domain-blocked-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'exact-name-homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-domain-blocked+verified-common-careers-routes-blocked+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /scopeknowledge\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /403/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Scope eKnowledge Center',
    modulePath: path.resolve(currentDir, '../../scraper/scopeeknowledgecenter/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Satvat Infosol local catalog captures the verified first-party Life @ Satvat openings page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/satvatinfosol/catalog.js',
    'SATVAT_INFOSOL_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'satvatinfosol')
  assert.equal(provider.companyName, 'Satvat Infosol')
  assert.equal(provider.officialBrandName, 'Satvat Infosol Private Limited')
  assert.equal(provider.homepageUrl, 'https://satvatinfosol.com/')
  assert.equal(provider.companyCareerPage, 'https://satvatinfosol.com/Careers.php')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-job-cards+shared-apply-form',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Software Programmer\/Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Chennai/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Satvat Infosol',
    modulePath: path.resolve(currentDir, '../../scraper/satvatinfosol/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
