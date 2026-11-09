import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const sandboxAQModulePath = path.resolve(currentDir, '../../scraper/sandboxaq/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sandboxaq/catalog.js')
  } catch {
    assert.fail('Expected SandboxAQ catalog module at ../../scraper/sandboxaq/catalog.js')
  }
}

const loadSandboxAQModule = async () => {
  try {
    return await import('../../scraper/sandboxaq/script.js')
  } catch {
    assert.fail('Expected SandboxAQ scraper module at ../../scraper/sandboxaq/script.js')
  }
}

test('SandboxAQ local catalog captures the verified official careers and public Ashby board contract', async () => {
  const { SANDBOXAQ_CATALOG } = await loadCatalogModule()
  const sandboxAQ = await loadSandboxAQModule()
  const provider = hydrateProviderCatalogEntry(SANDBOXAQ_CATALOG)

  assert.equal(provider.source, 'sandboxaq')
  assert.equal(provider.companyName, 'SandboxAQ')
  assert.equal(provider.officialBrandName, 'SandboxAQ')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sandboxaq.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sandboxaq.com/careers')
  assert.equal(provider.officialCareersListUrl, 'https://www.sandboxaq.com/careers-list')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/sandboxaq')
  assert.equal(provider.ashbyJobBoardUrl, 'https://api.ashbyhq.com/posting-api/job-board/sandboxaq')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-public-ashby-job-board-get')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-careers-list-shell+verified-public-ashby-board+public-ashby-get-feed',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sandboxaq.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, sandboxAQModulePath)
  assert.match(provider.dryRunFile, /sandboxaq[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sandboxaq\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sandboxaq\.com\/careers-list/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/sandboxaq/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/sandboxaq/i)
  assert.match(provider.verifiedSurfaceSummary, /Staff Machine Learning Engineer, AI Generation Engine/i)
  assert.match(provider.verifiedSurfaceSummary, /Product & Growth Marketer, AI Simulation/i)

  assert.equal(sandboxAQ.PROVIDER_METADATA.source, SANDBOXAQ_CATALOG.source)
  assert.equal(
    sandboxAQ.PROVIDER_METADATA.ashbyJobBoardUrl,
    SANDBOXAQ_CATALOG.ashbyJobBoardUrl,
  )
})

test('SandboxAQ exact backlog row matches directly from the local catalog without aliases', async () => {
  const { SANDBOXAQ_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SandboxAQ\n',
    catalog: [hydrateProviderCatalogEntry(SANDBOXAQ_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SandboxAQ', 'sandboxaq', 'SandboxAQ']],
  )
})
