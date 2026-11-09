import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadCatalogModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected catalog module at ${relativePath}`)
  }
}

const assertBacklogRowMatches = ({ provider, companyName, modulePath }) => {
  const report = generateCompanyCoverageReport({
    csvText: `${companyName}\n`,
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(provider.modulePath, modulePath)
}

test('SPARX IT Solutions local catalog captures the verified first-party careers accordion surface', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/sparxitsolutions/script.js')
  const {
    SPARX_IT_SOLUTIONS_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/sparxitsolutions/catalog.js')
  const provider = hydrateProviderCatalogEntry(SPARX_IT_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, SPARX_IT_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'sparxitsolutions')
  assert.equal(provider.companyName, 'SPARX IT Solutions')
  assert.equal(provider.officialBrandName, 'SparxIT')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sparxitsolutions.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sparxitsolutions.com/career.shtml')
  assert.equal(provider.companyDomain, 'sparxitsolutions.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-accordion')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-accordion-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-accordion+mail-to-apply-links+india-role-blocks',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Senior Android Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Project Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /Python Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /talent@sparxitsolutions\.com/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'SPARX IT Solutions',
    modulePath,
  })
})

test('Perpetuuiti Technosoft Services local catalog captures the verified migrated homepage and no-public-careers sentinel', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/perpetuuititechnosoftservices/script.js')
  const {
    PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/perpetuuititechnosoftservices/catalog.js')
  const provider = hydrateProviderCatalogEntry(PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG)

  assert.equal(defaultCatalog, PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG)
  assert.equal(provider.source, 'perpetuuititechnosoftservices')
  assert.equal(provider.companyName, 'Perpetuuiti Technosoft Services')
  assert.equal(provider.officialBrandName, 'Perpetuuiti')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://ptechnosoft.com/')
  assert.equal(provider.companyCareerPage, 'https://ptechnosoft.com/')
  assert.equal(provider.legacyCareersUrl, 'https://perpetuuiti.com/Careers.php')
  assert.equal(provider.legacyApplicationFormUrl, 'https://perpetuuiti.com/Careers-Form.php')
  assert.equal(provider.companyDomain, 'ptechnosoft.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-sitemap-plus-legacy-careers-redirect-plus-missing-routes',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-sitemap-without-careers-routes+legacy-careers-redirects-to-homepage+verified-missing-routes-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ptechnosoft\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /404 pages/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Perpetuuiti Technosoft Services',
    modulePath,
  })
})

test('Cybertech Systems & Software local catalog captures the verified first-party careers card grid', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/cybertechsystemsandsoftware/script.js')
  const {
    CYBERTECH_SYSTEMS_AND_SOFTWARE_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/cybertechsystemsandsoftware/catalog.js')
  const provider = hydrateProviderCatalogEntry(CYBERTECH_SYSTEMS_AND_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, CYBERTECH_SYSTEMS_AND_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'cybertechsystemsandsoftware')
  assert.equal(provider.companyName, 'Cybertech Systems & Software')
  assert.equal(provider.officialBrandName, 'CyberTech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://cybertech.com/')
  assert.equal(provider.companyCareerPage, 'https://cybertech.com/careers/')
  assert.equal(provider.companyDomain, 'cybertech.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-card-grid')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-card-grid')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-card-grid+card-level-apply-links',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Lead Public Cloud DevOps Automation Specialist/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr\.DBA \(MSSQL\)/i)
  assert.match(provider.verifiedSurfaceSummary, /SAP ABAP Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Full Time/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Cybertech Systems & Software',
    modulePath,
  })
})

test('Zieta Technologies local catalog captures the verified inline careers opening', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/zietatechnologies/script.js')
  const {
    ZIETA_TECHNOLOGIES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/zietatechnologies/catalog.js')
  const provider = hydrateProviderCatalogEntry(ZIETA_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, ZIETA_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'zietatechnologies')
  assert.equal(provider.companyName, 'Zieta Technologies')
  assert.equal(provider.officialBrandName, 'ZIETA')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.zietatech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.zietatech.com/index.php?page=careers')
  assert.equal(provider.companyDomain, 'zietatech.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-inline-opening')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-opening-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+inline-opening-text+modal-apply-handoff',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /LEAD SYSTEMS ANALYST/i)
  assert.match(provider.verifiedSurfaceSummary, /Roswell, GA 30076/i)
  assert.match(provider.verifiedSurfaceSummary, /Apply here/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Zieta Technologies',
    modulePath,
  })
})

test('Provab Technosoft local catalog captures the verified generic application-form sentinel', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/provabtechnosoft/script.js')
  const {
    PROVAB_TECHNOSOFT_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/provabtechnosoft/catalog.js')
  const provider = hydrateProviderCatalogEntry(PROVAB_TECHNOSOFT_CATALOG)

  assert.equal(defaultCatalog, PROVAB_TECHNOSOFT_CATALOG)
  assert.equal(provider.source, 'provabtechnosoft')
  assert.equal(provider.companyName, 'Provab Technosoft')
  assert.equal(provider.officialBrandName, 'PROVAB TECHNOSOFT')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.provab.com/')
  assert.equal(provider.companyCareerPage, 'https://www.provab.com/jobs/')
  assert.equal(provider.companyDomain, 'provab.com')
  assert.equal(provider.atsPlatform, 'first-party-generic-application-form-no-public-openings')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-form-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-generic-application-form+role-dropdown-without-public-openings+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Android Developers/i)
  assert.match(provider.verifiedSurfaceSummary, /Python Developers/i)
  assert.match(provider.verifiedSurfaceSummary, /UI \/ UX Designer/i)
  assert.match(provider.verifiedSurfaceSummary, /no public opening list/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Provab Technosoft',
    modulePath,
  })
})
