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

test('Saama Technologies local catalog captures the verified first-party Jobvite handoff', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/saamatechnologies/catalog.js',
    'SAAMA_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'saamatechnologies')
  assert.equal(provider.companyName, 'Saama Technologies')
  assert.equal(provider.officialBrandName, 'Saama')
  assert.equal(provider.homepageUrl, 'https://www.saama.com/')
  assert.equal(provider.companyCareerPage, 'https://www.saama.com/about/company/careers/')
  assert.equal(provider.jobsBoardUrl, 'https://jobs.jobvite.com/saama/')
  assert.equal(provider.atsPlatform, 'jobvite')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-handoff-plus-single-jobvite-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+jobvite-open-positions-board+india-detail-pages',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /jv-careersite widget/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Site Reliability Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Junior Accountant - Accounts Payable \(India\)/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Saama Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/saamatechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Aeries Technology local catalog captures the verified first-party TalentRecruit handoff', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/aeriestechnology/catalog.js',
    'AERIES_TECHNOLOGY_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'aeriestechnology')
  assert.equal(provider.companyName, 'Aeries Technology')
  assert.equal(provider.officialBrandName, 'Aeries Technology')
  assert.equal(provider.homepageUrl, 'https://aeriestechnology.com/')
  assert.equal(provider.companyCareerPage, 'https://aeriestechnology.com/careers/')
  assert.equal(provider.jobsBoardUrl, 'https://aeriestechnology.talentrecruit.com/Search/')
  assert.equal(provider.atsPlatform, 'talentrecruit')
  assert.equal(provider.paginationStrategy, 'single-talentrecruit-search-service-request')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+talentrecruit-search-board+searchjobsservice-api+india-listings',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Senior Executive\/Assistant Manager - Billing and Cash Application/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Cybersecurity Analyst/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Aeries Technology',
    modulePath: path.resolve(currentDir, '../../scraper/aeriestechnology/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('eNoah iSolution local catalog captures the verified zero-openings first-party surface', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/enoahisolution/catalog.js',
    'ENOAH_ISOLUTION_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'enoahisolution')
  assert.equal(provider.companyName, 'eNoah iSolution')
  assert.equal(provider.officialBrandName, 'eNoah iSolution')
  assert.equal(provider.homepageUrl, 'https://enoahisolution.com/')
  assert.equal(provider.companyCareerPage, 'https://enoahisolution.com/careers/')
  assert.equal(provider.jobsBoardUrl, 'https://enoahisolution.com/careers/jobs/')
  assert.equal(provider.atsPlatform, 'official-company-careers-zero-openings')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+zero-public-openings',
  )
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /Current Job Opportunities/i)
  assert.match(provider.verifiedSurfaceSummary, /no job openings/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'eNoah iSolution',
    modulePath: path.resolve(currentDir, '../../scraper/enoahisolution/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('MMC Infotech Services local catalog captures the verified first-party inline openings page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/mmcinfotechservices/catalog.js',
    'MMC_INFOTECH_SERVICES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'mmcinfotechservices')
  assert.equal(provider.companyName, 'MMC Infotech Services')
  assert.equal(provider.officialBrandName, 'MMC Infotech Services')
  assert.equal(provider.homepageUrl, 'https://www.mmcinfotech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mmcinfotech.com/career.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-job-openings',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Voice Operations/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Support/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Entry/i)
  assert.match(provider.verifiedSurfaceSummary, /Backend Process/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'MMC Infotech Services',
    modulePath: path.resolve(currentDir, '../../scraper/mmcinfotechservices/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Nitor Infotech local catalog captures the verified first-party openings page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/nitorinfotech/catalog.js',
    'NITOR_INFOTECH_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'nitorinfotech')
  assert.equal(provider.companyName, 'Nitor Infotech, an Ascendion company')
  assert.equal(provider.officialBrandName, 'Nitor Infotech')
  assert.equal(provider.homepageUrl, 'https://careers.nitorinfotech.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.nitorinfotech.com/')
  assert.equal(provider.jobsBoardUrl, 'https://careers.nitorinfotech.com/opening')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+openings-listing+india-filtered-cards',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.verifiedSurfaceSummary, /Engineering Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Engineer \(Golang\)/i)
  assert.match(provider.verifiedSurfaceSummary, /relative link \/opening/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Nitor Infotech, an Ascendion company',
    modulePath: path.resolve(currentDir, '../../scraper/nitorinfotech/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
