import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/moschiptechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/moschiptechnologies/catalog.js')
  } catch {
    assert.fail('Expected MosChip Technologies catalog module at ../../scraper/moschiptechnologies/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/moschiptechnologies/script.js')
  } catch {
    assert.fail('Expected MosChip Technologies scraper module at ../../scraper/moschiptechnologies/script.js')
  }
}

test('MosChip Technologies local catalog captures the verified first-party no-public-jobs careers sentinel state', async () => {
  const {
    MOSCHIP_TECHNOLOGIES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const moschipTechnologies = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MOSCHIP_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, MOSCHIP_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'moschiptechnologies')
  assert.equal(provider.companyName, 'MosChip Technologies')
  assert.equal(provider.officialBrandName, 'MosChip Technologies Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://moschip.com/')
  assert.equal(provider.companyCareerPage, 'https://moschip.com/careers/')
  assert.equal(provider.currentOpeningsUrl, 'https://moschip.com/careers/current-openings/')
  assert.equal(provider.emptyJobArchiveUrl, 'https://moschip.com/job-type/full-time/')
  assert.equal(provider.applicationEmail, 'careers@moschip.com')
  assert.equal(provider.applicationUrl, 'mailto:careers@moschip.com')
  assert.deepEqual(provider.noPublicCareerRouteUrls, [
    'https://moschip.com/jobs/',
    'https://moschip.com/openings/',
  ])
  assert.equal(provider.companyDomain, 'moschip.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-page-plus-current-openings-linkedin-handoff-plus-empty-job-archive-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-current-openings-linkedin-resume-handoff+verified-empty-job-archive-and-404-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.dryRunFile, /moschiptechnologies[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/moschip\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/moschip\.com\/careers\/current-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/moschip\.com\/job-type\/full-time\//i)
  assert.match(provider.verifiedSurfaceSummary, /careers@moschip\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Find Current Openings on/i)
  assert.match(provider.verifiedSurfaceSummary, /LinkedIn/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(
    moschipTechnologies.PROVIDER_METADATA.source,
    MOSCHIP_TECHNOLOGIES_CATALOG.source,
  )
  assert.equal(
    moschipTechnologies.PROVIDER_METADATA.companyName,
    MOSCHIP_TECHNOLOGIES_CATALOG.companyName,
  )
  assert.equal(
    moschipTechnologies.PROVIDER_METADATA.currentOpeningsUrl,
    MOSCHIP_TECHNOLOGIES_CATALOG.currentOpeningsUrl,
  )
})

test('MosChip Technologies exact backlog name matches directly from local provider metadata', async () => {
  const { MOSCHIP_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MosChip Technologies\n',
    catalog: [hydrateProviderCatalogEntry(MOSCHIP_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MosChip Technologies', 'moschiptechnologies', 'MosChip Technologies']],
  )
})

test('MosChip Technologies hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MOSCHIP_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MOSCHIP_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MosChip Technologies')
  assert.equal(provider.companyCareerPage, 'https://moschip.com/careers/')
  assert.equal(provider.companyDomain, 'moschip.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /moschiptechnologies[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /moschiptechnologies[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
