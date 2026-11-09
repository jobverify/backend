import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const elasticRunModulePath = path.resolve(currentDir, '../../scraper/elasticrun/script.js')

const loadElasticRunCatalog = async () => {
  try {
    return await import('../../scraper/elasticrun/catalog.js')
  } catch {
    assert.fail('Expected ElasticRun catalog module at ../../scraper/elasticrun/catalog.js')
  }
}

const loadElasticRunModule = async () => {
  try {
    return await import('../../scraper/elasticrun/script.js')
  } catch {
    assert.fail('Expected ElasticRun scraper module at ../../scraper/elasticrun/script.js')
  }
}

test('ElasticRun local catalog captures the verified first-party careers bundle and the live empty PeopleStrong jobs API', async () => {
  const { ELASTIC_RUN_CATALOG } = await loadElasticRunCatalog()
  const elasticRun = await loadElasticRunModule()

  assert.equal(ELASTIC_RUN_CATALOG.source, 'elasticrun')
  assert.equal(ELASTIC_RUN_CATALOG.companyName, 'ElasticRun')
  assert.equal(ELASTIC_RUN_CATALOG.officialBrandName, 'ElasticRun')
  assert.equal(ELASTIC_RUN_CATALOG.adapter, 'script')
  assert.equal(ELASTIC_RUN_CATALOG.homepageUrl, 'https://www.elastic.run/')
  assert.equal(ELASTIC_RUN_CATALOG.companyCareerPage, 'https://www.elastic.run/careers')
  assert.equal(ELASTIC_RUN_CATALOG.careersPageUrl, 'https://www.elastic.run/careers')
  assert.equal(ELASTIC_RUN_CATALOG.sitemapUrl, 'https://www.elastic.run/sitemap.xml')
  assert.equal(ELASTIC_RUN_CATALOG.portalOrigin, 'https://elasticruncareers.peoplestrong.com')
  assert.equal(
    ELASTIC_RUN_CATALOG.jobListingsUrl,
    'https://elasticruncareers.peoplestrong.com/job/joblist',
  )
  assert.equal(
    ELASTIC_RUN_CATALOG.jobsApiUrl,
    'https://elasticruncareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(ELASTIC_RUN_CATALOG.companyDomain, 'elastic.run')
  assert.equal(ELASTIC_RUN_CATALOG.atsPlatform, 'peoplestrong')
  assert.equal(ELASTIC_RUN_CATALOG.countryFilter, 'India')
  assert.equal(
    ELASTIC_RUN_CATALOG.paginationStrategy,
    'first-party-careers-shell-plus-peoplestrong-offset-limit-api',
  )
  assert.equal(
    ELASTIC_RUN_CATALOG.extractionStrategy,
    'first-party-careers-shell+client-bundle-handoff-to-broken-peoplestrong-joblist+peoplestrong-jobs-api-empty',
  )
  assert.equal(ELASTIC_RUN_CATALOG.parser, 'custom-script')
  assert.equal(ELASTIC_RUN_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ELASTIC_RUN_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(ELASTIC_RUN_CATALOG.dryRunFile, 'elasticrun/jobs.json')
  assert.match(ELASTIC_RUN_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.elastic\.run\/careers/i)
  assert.match(ELASTIC_RUN_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.elastic\.run\/sitemap\.xml/i)
  assert.match(
    ELASTIC_RUN_CATALOG.verifiedSurfaceSummary,
    /https:\/\/elasticruncareers\.peoplestrong\.com\/job\/joblist/i,
  )
  assert.match(
    ELASTIC_RUN_CATALOG.verifiedSurfaceSummary,
    /https:\/\/elasticruncareers\.peoplestrong\.com\/api\/cp\/rest\/altone\/cp\/jobs\/v1\?offset=0&limit=20/i,
  )
  assert.match(ELASTIC_RUN_CATALOG.verifiedSurfaceSummary, /Candidate Portal shell/i)
  assert.match(ELASTIC_RUN_CATALOG.verifiedSurfaceSummary, /totalRecords[: ]+0/i)
  assert.equal(ELASTIC_RUN_CATALOG.modulePath, elasticRunModulePath)

  assert.equal(elasticRun.PROVIDER_METADATA.source, ELASTIC_RUN_CATALOG.source)
  assert.equal(elasticRun.PROVIDER_METADATA.companyName, ELASTIC_RUN_CATALOG.companyName)
  assert.equal(elasticRun.PROVIDER_METADATA.careersPageUrl, ELASTIC_RUN_CATALOG.careersPageUrl)
  assert.equal(elasticRun.PROVIDER_METADATA.jobListingsUrl, ELASTIC_RUN_CATALOG.jobListingsUrl)
})

test('ElasticRun backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { ELASTIC_RUN_CATALOG } = await loadElasticRunCatalog()
  const provider = hydrateProviderCatalogEntry(ELASTIC_RUN_CATALOG)

  assert.equal(provider.companyName, 'ElasticRun')
  assert.equal(provider.companyDomain, 'elastic.run')
  assert.match(provider.modulePath, /elasticrun[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /elasticrun[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'ElasticRun'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'ElasticRun\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ElasticRun', 'elasticrun', 'ElasticRun']],
  )
})
