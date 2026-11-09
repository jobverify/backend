import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/stridespharma/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/stridespharma/catalog.js')
  } catch {
    assert.fail('Expected Strides Pharma catalog module at ../../scraper/stridespharma/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/stridespharma/script.js')
  } catch {
    assert.fail('Expected Strides Pharma scraper module at ../../scraper/stridespharma/script.js')
  }
}

test('Strides Pharma local catalog captures the verified first-party careers handoff and public service contract', async () => {
  const { STRIDES_PHARMA_CATALOG } = await loadCatalogModule()
  const stridesPharma = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(STRIDES_PHARMA_CATALOG)

  assert.equal(STRIDES_PHARMA_CATALOG.source, 'stridespharma')
  assert.equal(STRIDES_PHARMA_CATALOG.companyName, 'Strides Pharma')
  assert.equal(STRIDES_PHARMA_CATALOG.officialBrandName, 'Strides Pharma Science Limited')
  assert.equal(STRIDES_PHARMA_CATALOG.adapter, 'script')
  assert.equal(STRIDES_PHARMA_CATALOG.modulePath, modulePath)
  assert.equal(STRIDES_PHARMA_CATALOG.dryRunFile, 'stridespharma/jobs.json')
  assert.equal(STRIDES_PHARMA_CATALOG.officialHomepageUrl, 'https://www.strides.com/')
  assert.equal(STRIDES_PHARMA_CATALOG.companyCareerPage, 'https://www.strides.com/careers')
  assert.equal(
    STRIDES_PHARMA_CATALOG.officialCareersHandoffUrl,
    'https://portal.arcolab.com/careerportal/',
  )
  assert.equal(
    STRIDES_PHARMA_CATALOG.portalJobServiceUrl,
    'https://portal.arcolab.com/careerportal/ServiceHandler.svc/GenericMethod',
  )
  assert.equal(
    STRIDES_PHARMA_CATALOG.applicationStatusUrl,
    'https://portal.arcolab.com/careerportal/main.aspx?loc=002',
  )
  assert.equal(STRIDES_PHARMA_CATALOG.portalCompanyToken, 'Strides')
  assert.equal(STRIDES_PHARMA_CATALOG.listingKey, '300000100001')
  assert.equal(STRIDES_PHARMA_CATALOG.detailKey, '300000100003')
  assert.equal(STRIDES_PHARMA_CATALOG.companyDomain, 'strides.com')
  assert.equal(STRIDES_PHARMA_CATALOG.atsPlatform, 'arcolab-careerportal')
  assert.equal(STRIDES_PHARMA_CATALOG.countryFilter, 'India')
  assert.equal(
    STRIDES_PHARMA_CATALOG.paginationStrategy,
    'verified-careers-page-plus-public-servicehandler-xml-listing',
  )
  assert.equal(
    STRIDES_PHARMA_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+arcolab-portal+public-servicexml-job-list-and-detail',
  )
  assert.equal(STRIDES_PHARMA_CATALOG.parser, 'custom-script')
  assert.equal(STRIDES_PHARMA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(STRIDES_PHARMA_CATALOG.verifiedOn, '2026-07-17')
  assert.match(STRIDES_PHARMA_CATALOG.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(STRIDES_PHARMA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.strides\.com\/careers/i)
  assert.match(STRIDES_PHARMA_CATALOG.verifiedSurfaceSummary, /https:\/\/portal\.arcolab\.com\/careerportal\//i)
  assert.match(
    STRIDES_PHARMA_CATALOG.verifiedSurfaceSummary,
    /ServiceHandler\.svc\/GenericMethod/i,
  )
  assert.match(STRIDES_PHARMA_CATALOG.verifiedSurfaceSummary, /300000100001/i)
  assert.match(STRIDES_PHARMA_CATALOG.verifiedSurfaceSummary, /300000100003/i)

  assert.equal(provider.source, 'stridespharma')
  assert.equal(provider.companyName, 'Strides Pharma')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.strides.com/careers')
  assert.equal(provider.companyDomain, 'strides.com')
  assert.match(provider.modulePath, /stridespharma[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /stridespharma[\\/]jobs\.json$/i)

  assert.equal(stridesPharma.PROVIDER_METADATA.source, provider.source)
  assert.equal(stridesPharma.CAREERS_URL, provider.companyCareerPage)
  assert.equal(stridesPharma.PORTAL_JOBS_SERVICE_URL, provider.portalJobServiceUrl)
})

test('Strides Pharma exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { STRIDES_PHARMA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Strides Pharma\n',
    catalog: [hydrateProviderCatalogEntry(STRIDES_PHARMA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Strides Pharma', 'stridespharma', 'Strides Pharma']],
  )
})
