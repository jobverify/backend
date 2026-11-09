import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/ivy/provider.js')
  } catch {
    assert.fail('Expected ivy provider module at ../../scraper/ivy/provider.js')
  }
}

test('ivy provider captures the verified Ivy Comptech first-party blocked-surface contract', async () => {
  const { provider, default: defaultProvider } = await loadProviderModule()

  assert.equal(defaultProvider, provider)
  assert.equal(provider.source, 'ivy')
  assert.equal(provider.companyName, 'ivy')
  assert.equal(provider.officialBrandName, 'Ivy Comptech')
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
    'verified-ivy-global-homepage+verified-contact-entities+blocked-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Ivy Comptech/i)
  assert.match(provider.verifiedSurfaceSummary, /Ivy Software Development Services Private Limited/i)
  assert.match(provider.modulePath, /ivy[\\/]script\.js$/i)
})

test('ivy backlog matching works from the local provider metadata without shared aliases', async () => {
  const { provider } = await loadProviderModule()

  const report = generateCompanyCoverageReport({
    csvText: 'ivy\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ivy', 'ivy', 'ivy']],
  )
})
