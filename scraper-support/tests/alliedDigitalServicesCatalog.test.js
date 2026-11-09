import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const alliedModulePath = path.resolve(currentDir, '../../scraper/allieddigitalservices/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/allieddigitalservices/catalog.js')
  } catch {
    assert.fail('Expected Allied Digital Services catalog module at ../../scraper/allieddigitalservices/catalog.js')
  }
}

const loadAlliedModule = async () => {
  try {
    return await import('../../scraper/allieddigitalservices/script.js')
  } catch {
    assert.fail('Expected Allied Digital Services scraper module at ../../scraper/allieddigitalservices/script.js')
  }
}

test('Allied Digital Services catalog connects the current WordPress inventory and India-filtered scraper', async () => {
  const { ALLIED_DIGITAL_SERVICES_CATALOG } = await loadCatalogModule()
  const allied = await loadAlliedModule()
  const provider = hydrateProviderCatalogEntry(ALLIED_DIGITAL_SERVICES_CATALOG)

  assert.equal(provider.source, 'allieddigitalservices')
  assert.equal(provider.companyName, 'Allied Digital Services')
  assert.equal(provider.companyCareerPage, 'https://www.allieddigital.net/careers/')
  assert.equal(provider.companyDomain, 'allieddigital.net')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.modulePath, alliedModulePath)
  assert.equal(allied.CAREERS_URL, provider.companyCareerPage)
  assert.equal(allied.HIRING_NOW_URL, 'https://www.allieddigital.net/job-openings/')
  assert.equal(allied.JOBS_API_URL, 'https://www.allieddigital.net/wp-json/wp/v2/awsm_job_openings')
  assert.equal(allied.PROVIDER_METADATA, ALLIED_DIGITAL_SERVICES_CATALOG)
})

test('Allied Digital Services local catalog hydrates into coverage without needing a shared alias entry', async () => {
  const { ALLIED_DIGITAL_SERVICES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ALLIED_DIGITAL_SERVICES_CATALOG)

  assert.equal(provider.companyName, 'Allied Digital Services')
  assert.equal(provider.companyDomain, 'allieddigital.net')
  assert.match(provider.modulePath, /allieddigitalservices[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /allieddigitalservices[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Allied Digital Services\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Allied Digital Services', 'allieddigitalservices', 'Allied Digital Services']],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Allied Digital Services'),
    false,
  )
})

test('buildScrapers and company coverage resolve Allied Digital Services from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'allieddigitalservices')
  const scraper = buildScrapers().find((item) => item.name === 'allieddigitalservices')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Allied Digital Services')
  assert.equal(provider.companyCareerPage, 'https://www.allieddigital.net/careers/')
  assert.match(scraper.dryRunFile, /allieddigitalservices[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Allied Digital Services\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Allied Digital Services', 'allieddigitalservices', 'Allied Digital Services']],
  )
})
