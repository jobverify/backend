import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/figma/catalog.js')
  } catch {
    assert.fail('Expected Figma catalog module at ../../scraper/figma/catalog.js')
  }
}

const loadFigmaModule = async () => {
  try {
    return await import('../../scraper/figma/script.js')
  } catch {
    assert.fail('Expected Figma scraper module at ../../scraper/figma/script.js')
  }
}

test('Figma local catalog captures the verified first-party careers page and Greenhouse jobs surface without aliases', async () => {
  const { FIGMA_CATALOG } = await loadCatalogModule()
  const figma = await loadFigmaModule()
  const provider = hydrateProviderCatalogEntry(FIGMA_CATALOG)

  assert.equal(provider.source, 'figma')
  assert.equal(provider.companyName, 'Figma')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /figma[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://www.figma.com/careers/')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.figma.com/careers/')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/figma/jobs')
  assert.equal(provider.greenhouseJobBaseUrl, 'https://boards.greenhouse.io/figma/jobs')
  assert.equal(
    provider.sampleJobUrl,
    'https://boards.greenhouse.io/figma/jobs/5579204004?gh_jid=5579204004',
  )
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-greenhouse-job-links+greenhouse-jobs-api+public-greenhouse-detail-urls',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'figma.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.figma\.com\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/figma\/jobs\?content=true/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards\.greenhouse\.io\/figma\/jobs\/5579204004\?gh_jid=5579204004/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards\.greenhouse\.io\/figma\/jobs\/5615966004\?gh_jid=5615966004/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b166 live roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Bengaluru, India/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Figma'), false)

  assert.equal(figma.PROVIDER_METADATA.source, FIGMA_CATALOG.source)
  assert.equal(figma.PROVIDER_METADATA.companyName, FIGMA_CATALOG.companyName)
  assert.equal(figma.PROVIDER_METADATA.companyCareerPage, FIGMA_CATALOG.companyCareerPage)
  assert.equal(figma.PROVIDER_METADATA.greenhouseJobsApiUrl, FIGMA_CATALOG.greenhouseJobsApiUrl)
})

test('Figma backlog row matches directly from local provider metadata without alias churn', async () => {
  const { FIGMA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Figma\n',
    catalog: [hydrateProviderCatalogEntry(FIGMA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Figma', 'figma', 'Figma']],
  )
})
