import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/innoverdigital/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/innoverdigital/catalog.js')
  } catch {
    assert.fail('Expected Innover Digital catalog module at ../../scraper/innoverdigital/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/innoverdigital/script.js')
  } catch {
    assert.fail('Expected Innover Digital scraper module at ../../scraper/innoverdigital/script.js')
  }
}

test('Innover Digital local catalog captures the verified careers handoff and public Zoho Recruit API', async () => {
  const { INNOVER_DIGITAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const innoverDigital = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(INNOVER_DIGITAL_CATALOG)

  assert.equal(defaultCatalog, INNOVER_DIGITAL_CATALOG)
  assert.equal(provider.source, 'innoverdigital')
  assert.equal(provider.companyName, 'Innover Digital')
  assert.equal(provider.officialBrandName, 'Innover')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.innoverdigital.com/')
  assert.equal(provider.companyCareerPage, 'https://www.innoverdigital.com/about/careers/')
  assert.equal(provider.careersPortalUrl, 'https://innoverdigital.zohorecruit.in/jobs/Careers')
  assert.equal(
    provider.careersApiUrl,
    'https://innoverdigital.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-handoff-plus-public-zoho-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+branded-zohorecruit-portal+public-job-openings-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'innoverdigital.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Build a rewarding career with Innover/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/innoverdigital\.zohorecruit\.in\/jobs\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Application Support Manager \/ Sr\. Manager/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /innoverdigital[\\/]jobs\.json$/i)

  assert.equal(innoverDigital.PROVIDER_METADATA.source, provider.source)
  assert.equal(innoverDigital.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(innoverDigital.PROVIDER_METADATA.careersPortalUrl, provider.careersPortalUrl)
})

test('Innover Digital coverage resolves exact backlog rows without alias churn', async () => {
  const { INNOVER_DIGITAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Innover Digital\nInnover Digital Pvt Ltd\n',
    catalog: [hydrateProviderCatalogEntry(INNOVER_DIGITAL_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Innover Digital', 'innoverdigital', 'Innover Digital'],
      ['Innover Digital Pvt Ltd', 'innoverdigital', 'Innover Digital'],
    ],
  )
})
