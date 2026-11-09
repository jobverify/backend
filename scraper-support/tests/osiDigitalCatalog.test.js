import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/osidigital/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/osidigital/catalog.js')
  } catch {
    assert.fail('Expected OSI Digital catalog module at ../../scraper/osidigital/catalog.js')
  }
}

test('OSI Digital local catalog captures the verified first-party careers flow and embedded TurboHire public jobs feed', async () => {
  const { OSI_DIGITAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OSI_DIGITAL_CATALOG)

  assert.equal(defaultCatalog, OSI_DIGITAL_CATALOG)
  assert.equal(provider.source, 'osidigital')
  assert.equal(provider.companyName, 'OSI Digital')
  assert.equal(provider.officialBrandName, 'OSI Digital')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://osidigital.com/careers/')
  assert.equal(provider.companyDomain, 'osidigital.com')
  assert.equal(provider.jobOpeningsUrl, 'https://osidigital.com/careers/job_openings/')
  assert.equal(provider.jobBoardApiUrl, 'https://api.turbohire.co/api/careerpagejobs')
  assert.equal(provider.publicApplyHost, 'https://osidigital.turbohire.co')
  assert.equal(provider.atsPlatform, 'official-careers-page-plus-turbohire-publicjobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-embedded-turbohire-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-job-openings-page+embedded-turbohire-api+public-job-feed',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.verifiedPublicPostingCount, 23)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /job_openings/i)
  assert.match(provider.verifiedSurfaceSummary, /api\.turbohire\.co\/api\/careerpagejobs/i)
  assert.match(provider.verifiedSurfaceSummary, /23 public jobs/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /osidigital[\\/]jobs\.json$/i)
})
