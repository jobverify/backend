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

test('Nuvento Systems local catalog captures the verified first-party India careers page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/nuventosystems/catalog.js',
    'NUVENTO_SYSTEMS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'nuventosystems')
  assert.equal(provider.companyName, 'Nuvento Systems')
  assert.equal(provider.officialBrandName, 'Nuvento')
  assert.equal(provider.homepageUrl, 'https://nuvento.com/')
  assert.equal(provider.careersHubUrl, 'https://nuvento.com/careers/')
  assert.equal(provider.companyCareerPage, 'https://nuvento.com/careers/kochi/')
  assert.deepEqual(provider.resumeEmails, [
    'naseeba.parvin@nuvento.com',
    'anindita.ghosal@nuvento.com',
  ])
  assert.equal(provider.atsPlatform, 'first-party-india-careers-page')
  assert.equal(provider.paginationStrategy, 'single-first-party-india-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-hub+india-careers-page-inline-role-sections',
  )
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /accordion role sections/i)
  assert.match(provider.verifiedSurfaceSummary, /HR Trainee, Intern - Automation/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Nuvento Systems',
    modulePath: path.resolve(currentDir, '../../scraper/nuventosystems/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Quale Infotech local catalog captures the verified homepage-only fail-closed contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/qualeinfotech/catalog.js',
    'QUALE_INFOTECH_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'qualeinfotech')
  assert.equal(provider.companyName, 'Quale Infotech')
  assert.equal(provider.officialBrandName, 'Quale Infotech')
  assert.equal(provider.homepageUrl, 'https://qualeinfotech.com/')
  assert.equal(provider.companyCareerPage, 'https://qualeinfotech.com/')
  assert.equal(provider.aboutPageUrl, 'https://qualeinfotech.com/about-us/')
  assert.equal(provider.contactPageUrl, 'https://qualeinfotech.com/contact-us/')
  assert.equal(provider.atsPlatform, 'first-party-homepage-without-public-careers-surface')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-plus-contact-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+about+contact-without-public-careers-or-jobs+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /Generative AI/i)
  assert.match(provider.verifiedSurfaceSummary, /\/careers, \/jobs, and \/join-us/i)
  assert.match(provider.verifiedSurfaceSummary, /no public careers or jobs page/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Quale Infotech',
    modulePath: path.resolve(currentDir, '../../scraper/qualeinfotech/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Capital Numbers Infotech local catalog captures the verified public-role careers page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/capitalnumbersinfotech/catalog.js',
    'CAPITAL_NUMBERS_INFOTECH_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'capitalnumbersinfotech')
  assert.equal(provider.companyName, 'Capital Numbers Infotech')
  assert.equal(provider.officialBrandName, 'Capital Numbers')
  assert.equal(provider.homepageUrl, 'https://www.capitalnumbers.com/')
  assert.equal(provider.companyCareerPage, 'https://www.capitalnumbers.com/careers.php')
  assert.equal(provider.contactEmail, 'jobs@capitalnumbers.com')
  assert.equal(provider.atsPlatform, 'official-first-party-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'complete-public-role-cards+email-apply',
  )
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.match(provider.verifiedSurfaceSummary, /four current role cards/i)
  assert.match(provider.verifiedSurfaceSummary, /identifier is validated/i)
  assert.match(provider.verifiedSurfaceSummary, /verified India locations/i)
  assert.match(provider.verifiedSurfaceSummary, /September 13, 2026/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Capital Numbers Infotech',
    modulePath: path.resolve(currentDir, '../../scraper/capitalnumbersinfotech/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('In Time Tec Visionsoft local catalog captures the verified careers page plus public zwayam APIs', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/intimetecvisionsoft/catalog.js',
    'IN_TIME_TEC_VISIONSOFT_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'intimetecvisionsoft')
  assert.equal(provider.companyName, 'In Time Tec Visionsoft')
  assert.equal(provider.officialBrandName, 'In Time Tec')
  assert.equal(provider.homepageUrl, 'https://www.intimetec.com/')
  assert.equal(provider.companyCareerPage, 'https://www.intimetec.com/careers')
  assert.equal(provider.indiaJobsUrl, 'https://careers.intimetec.in/intimetec/jobslist')
  assert.equal(provider.searchApiUrl, 'https://public.zwayam.com/jobs/search')
  assert.equal(provider.detailApiUrl, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(provider.companyApiId, 'MTUxOTQ=')
  assert.equal(provider.detailCompanyId, '15194')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-zwayam-search-api')
  assert.equal(provider.paginationStrategy, 'zwayam-search-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-zwayam-search-api+zwayam-job-details+india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /public zwayam jobs search api/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior AI Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Linux Administrator/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'In Time Tec Visionsoft',
    modulePath: path.resolve(currentDir, '../../scraper/intimetecvisionsoft/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Miracle Software Systems local catalog captures the verified first-party open positions board', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/miraclesoftwaresystems/catalog.js',
    'MIRACLE_SOFTWARE_SYSTEMS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'miraclesoftwaresystems')
  assert.equal(provider.companyName, 'Miracle Software Systems')
  assert.equal(provider.officialBrandName, 'Miracle Software Systems, Inc.')
  assert.equal(provider.homepageUrl, 'https://www.miraclesoft.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.miraclesoft.com/')
  assert.equal(provider.atsPlatform, 'first-party-careers-site')
  assert.equal(provider.paginationStrategy, 'single-first-party-open-positions-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+visible-open-position-cards',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.verifiedSurfaceSummary, /ServiceNow ITSM Architect/i)
  assert.match(provider.verifiedSurfaceSummary, /Microsoft Dynamics 365 \(D365\) Technical Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /SQL\/UKG Developer/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Miracle Software Systems',
    modulePath: path.resolve(currentDir, '../../scraper/miraclesoftwaresystems/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
