import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/ivysoftwaredevelopmentservices/provider.js')
  } catch {
    assert.fail('Expected IVY SOFTWARE DEVELOPMENT SERVICES provider module at ../../scraper/ivysoftwaredevelopmentservices/provider.js')
  }
}

test('IVY SOFTWARE DEVELOPMENT SERVICES provider captures the shared Ivy Comptech blocked-surface contract', async () => {
  const { provider, default: defaultProvider } = await loadProviderModule()

  assert.equal(defaultProvider, provider)
  assert.equal(provider.source, 'ivysoftwaredevelopmentservices')
  assert.equal(provider.companyName, 'IVY SOFTWARE DEVELOPMENT SERVICES')
  assert.equal(provider.officialBrandName, 'Ivy Software Development Services Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://ivy.global/')
  assert.equal(provider.contactPageUrl, 'https://ivy.global/contact')
  assert.equal(provider.companyDomain, 'ivy.global')
  assert.equal(provider.atsPlatform, 'official-company-site-blocked-careers-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-contact-plus-blocked-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-ivy-global-homepage+verified-contact-entity+blocked-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /ivy\.global/i)
  assert.match(provider.verifiedSurfaceSummary, /shared with ivy/i)
  assert.match(provider.modulePath, /ivysoftwaredevelopmentservices[\\/]script\.js$/i)
})

test('IVY SOFTWARE DEVELOPMENT SERVICES backlog matching works from the local provider metadata', async () => {
  const { provider } = await loadProviderModule()

  const report = generateCompanyCoverageReport({
    csvText: 'IVY SOFTWARE DEVELOPMENT SERVICES\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IVY SOFTWARE DEVELOPMENT SERVICES', 'ivysoftwaredevelopmentservices', 'IVY SOFTWARE DEVELOPMENT SERVICES']],
  )
})
